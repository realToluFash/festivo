<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Domain\Messaging\Exception\Unreachable;
use App\Domain\Messaging\Interfaces\AudienceResolverInterface;
use App\Domain\Messaging\Interfaces\NotificationPreferencesInterface;
use App\Domain\Messaging\Interfaces\NotificationTypeInterface;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\EventState;
use App\Domain\Messaging\Model\EventVerdict;
use App\Enum\EventStatus;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationChannel;
use App\Enum\NotificationDeliveryStatus;
use App\Enum\NotificationHold;
use App\Enum\NotificationPriority;
use App\Enum\ScheduledNotificationStatus;
use App\Repository\EventMuteRepository;
use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use LogicException;
use Psl\Iter;
use Psl\Json;
use Psl\PseudoRandom;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\AutowireIterator;
use Symfony\Component\Uid\Uuid;
use Throwable;

/** One row per claim: a batch would keep an urgent row waiting behind it. The lease commits before any provider is called. */
final class NotificationWorker
{
    public const int CHUNK = 250;

    public const string LEASE = 'PT60S';

    public const string HOLD_RECHECK = 'PT60S';

    /** @var array<string, AudienceResolverInterface> */
    private array $resolvers = [];

    /** @param iterable<AudienceResolverInterface> $resolvers */
    public function __construct(
        private readonly Connection $connection,
        private readonly NotificationRegistry $notificationRegistry,
        private readonly ChannelSelector $channelSelector,
        private readonly EventMuteRepository $eventMuteRepository,
        private readonly NotificationPreferencesInterface $notificationPreferences,
        private readonly ClockInterface $clock,
        private readonly LoggerInterface $logger,
        #[AutowireIterator(AudienceResolverInterface::TAG)]
        iterable $resolvers,
    ) {
        foreach ($resolvers as $resolver) {
            $this->resolvers[$resolver->kind()->value] = $resolver;
        }
    }

    /** @return bool whether there was anything due to handle */
    public function step(): bool
    {
        return $this->fanOutNext(NotificationPriority::Urgent)
            || $this->sendNext(NotificationPriority::Urgent)
            || $this->fanOutNext(NotificationPriority::Info)
            || $this->sendNext(NotificationPriority::Info);
    }

    private function fanOutNext(NotificationPriority $atMost): bool
    {
        $now = $this->clock->now();
        $row = $this->connection->fetchAssociative(
            <<<'SQL'
                UPDATE scheduled_notifications
                SET claimed_at = :now, claimed_until = :lease
                WHERE id = (
                    SELECT id FROM scheduled_notifications
                    WHERE status = :pending
                      AND due_at <= :now
                      AND priority <= :priority
                      AND (claimed_until IS NULL OR claimed_until < :now)
                    ORDER BY due_at, id
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING id, type, event_id, organisation_id, due_at, send_by, audience, payload, priority, fanned_out_after
                SQL,
            [
                'now' => $now,
                'lease' => $now->add(new DateInterval(self::LEASE)),
                'pending' => ScheduledNotificationStatus::Pending->value,
                'priority' => $atMost->value,
            ],
            ['now' => Types::DATETIME_IMMUTABLE, 'lease' => Types::DATETIME_IMMUTABLE],
        );

        if (false === $row) {
            return false;
        }

        $id = Type\string()->coerce($row['id']);

        try {
            $this->fanOut($id, $row, $now);
        } catch (Throwable $failure) {
            $this->finishScheduled($id, ScheduledNotificationStatus::Failed, $failure::class);
            $this->logger->error('A scheduled notification could not be fanned out.', ['scheduled' => $id, 'reason' => $failure::class]);
        }

        return true;
    }

    /** @param array<string, mixed> $row */
    private function fanOut(string $id, array $row, DateTimeImmutable $now): void
    {
        $typeName = Type\string()->coerce($row['type']);

        if (!$this->notificationRegistry->has($typeName)) {
            $this->finishScheduled($id, ScheduledNotificationStatus::Failed, 'unregistered type');

            return;
        }

        $type = $this->notificationRegistry->type($typeName);
        $sendBy = self::moment($row['send_by']);

        if (null !== $sendBy && $sendBy < $now) {
            $this->finishScheduled($id, ScheduledNotificationStatus::TooLate, 'too late');

            return;
        }

        $eventId = Type\nullable(Type\string())->coerce($row['event_id']);
        $event = null === $eventId ? null : $this->eventState($eventId);
        $deleted = null === $eventId ? $this->organisationDeleted($row['organisation_id']) : true === $event?->deleted;
        $verdict = match (true) {
            null !== $eventId => EventGate::verdict($type->eventRule(), $event, $now),
            $deleted => EventVerdict::Hold,
            default => EventVerdict::Send,
        };

        if (EventVerdict::Cancel === $verdict) {
            $this->finishScheduled($id, ScheduledNotificationStatus::Cancelled, 'the event no longer takes it');

            return;
        }

        if (EventVerdict::Hold === $verdict && $deleted) {
            $this->holdScheduled($id, $now);

            return;
        }

        if (!$type->isStillDue(self::dict($row['payload']))) {
            $this->finishScheduled($id, ScheduledNotificationStatus::Cancelled, 'no longer due');

            return;
        }

        $audience = Audience::fromArray(self::dict($row['audience']));
        $resolver = $this->resolvers[$audience->kind->value] ?? null;

        if (null === $resolver) {
            $this->finishScheduled($id, ScheduledNotificationStatus::Failed, Str\format('nothing resolves a %s audience yet', $audience->kind->value));

            return;
        }

        $after = Type\nullable(Type\string())->coerce($row['fanned_out_after']);
        $recipients = $resolver->resolve($audience, null === $after ? null : Uuid::fromString($after), self::CHUNK);

        $this->connection->transactional(function () use ($id, $type, $audience, $recipients, $eventId, $row, $now, $sendBy): void {
            if (!$this->lockPending($id)) {
                return;
            }

            $this->writeDeliveries($id, $type, $audience->kind, $recipients, $eventId, self::moment($row['due_at']) ?? $now, $sendBy);

            if (Iter\count($recipients) < self::CHUNK) {
                $this->finishScheduled($id, ScheduledNotificationStatus::FannedOut, null);
            } else {
                $this->connection->executeStatement(
                    'UPDATE scheduled_notifications SET fanned_out_after = :after, held = NULL, claimed_until = NULL WHERE id = :id',
                    ['after' => Iter\last($recipients)?->toRfc4122(), 'id' => $id],
                );
            }
        });
    }

    /** Before fan-out, because a deleted event's or organisation's audience resolves to nobody (sc-104, sc-17126). Its lease is its recheck. */
    private function holdScheduled(string $id, DateTimeImmutable $now): void
    {
        $this->connection->executeStatement(
            'UPDATE scheduled_notifications SET held = :held, claimed_until = :recheck WHERE id = :id AND status = :pending',
            [
                'held' => NotificationHold::Deleted->value,
                'recheck' => $now->add(new DateInterval(self::HOLD_RECHECK)),
                'id' => $id,
                'pending' => ScheduledNotificationStatus::Pending->value,
            ],
            ['recheck' => Types::DATETIME_IMMUTABLE],
        );
    }

    /** Cancelled or replaced since the claim: the scheduler's update waits on this lock, or this sees what it wrote. */
    private function lockPending(string $id): bool
    {
        return false !== $this->connection->fetchOne(
            'SELECT 1 FROM scheduled_notifications WHERE id = :id AND status = :pending FOR UPDATE',
            ['id' => $id, 'pending' => ScheduledNotificationStatus::Pending->value],
        );
    }

    /** @param list<Uuid> $recipients */
    private function writeDeliveries(string $scheduledId, NotificationTypeInterface $type, NotificationAudienceKind $kind, array $recipients, ?string $eventId, DateTimeImmutable $dueAt, ?DateTimeImmutable $sendBy): void
    {
        $sourceId = Type\string()->coerce($this->connection->fetchOne('SELECT source_id FROM scheduled_notifications WHERE id = :id', ['id' => $scheduledId]));
        $now = $this->clock->now();
        $muted = null === $eventId || NotificationAudienceKind::Member !== $kind ? [] : $this->eventMuteRepository->findMutedAmong($eventId, $recipients);

        foreach ($recipients as $recipient) {
            foreach ($this->channelSelector->select($kind, $recipient, $type->category(), $type->channels(), Iter\contains($muted, $recipient->toRfc4122())) as $channel) {
                $urgent = NotificationPriority::Urgent === $type->priority() || NotificationChannel::InApp === $channel;
                $this->connection->executeStatement(
                    <<<'SQL'
                        INSERT INTO notification_deliveries (
                            id, scheduled_notification_id, event_id, type, source_id, recipient_kind, recipient_id, channel,
                            priority, collapse_key, status, due_at, next_attempt_at, send_by, attempts, created_at
                        ) VALUES (
                            :id, :scheduled, :event, :type, :source, :kind, :recipient, :channel,
                            :priority, :collapse, :pending, :due, :due, :sendBy, 0, :now
                        )
                        ON CONFLICT (type, source_id, recipient_kind, recipient_id, channel) DO NOTHING
                        SQL,
                    [
                        'id' => Uuid::v7()->toRfc4122(),
                        'scheduled' => $scheduledId,
                        'event' => $eventId,
                        'type' => $type->name(),
                        'source' => $sourceId,
                        'kind' => $kind->value,
                        'recipient' => $recipient->toRfc4122(),
                        'channel' => $channel->value,
                        'priority' => ($urgent ? NotificationPriority::Urgent : $type->priority())->value,
                        'collapse' => $type->collapseKey(),
                        'pending' => NotificationDeliveryStatus::Pending->value,
                        'due' => $dueAt,
                        'sendBy' => $sendBy,
                        'now' => $now,
                    ],
                    ['due' => Types::DATETIME_IMMUTABLE, 'sendBy' => Types::DATETIME_IMMUTABLE, 'now' => Types::DATETIME_IMMUTABLE],
                );
            }
        }
    }

    private function sendNext(NotificationPriority $atMost): bool
    {
        $now = $this->clock->now();
        $row = $this->connection->fetchAssociative(
            <<<'SQL'
                UPDATE notification_deliveries
                SET claimed_at = :now, claimed_until = :lease
                WHERE id = (
                    SELECT id FROM notification_deliveries
                    WHERE status = :pending
                      AND next_attempt_at <= :now
                      AND priority <= :priority
                      AND (claimed_until IS NULL OR claimed_until < :now)
                    ORDER BY next_attempt_at, id
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING id
                SQL,
            [
                'now' => $now,
                'lease' => $now->add(new DateInterval(self::LEASE)),
                'pending' => NotificationDeliveryStatus::Pending->value,
                'priority' => $atMost->value,
            ],
            ['now' => Types::DATETIME_IMMUTABLE, 'lease' => Types::DATETIME_IMMUTABLE],
        );

        if (false === $row) {
            return false;
        }

        $id = Type\string()->coerce($row['id']);

        try {
            $this->deliver($id, $now);
        } catch (Throwable $failure) {
            $this->finishDelivery($id, NotificationDeliveryStatus::Failed, $failure::class);
            $this->logger->error('A notification could not be delivered.', ['delivery' => $id, 'reason' => $failure::class]);
        }

        return true;
    }

    private function deliver(string $id, DateTimeImmutable $now): void
    {
        $row = $this->delivery($id);
        $typeName = Type\string()->coerce($row['type']);

        if (!$this->notificationRegistry->has($typeName)) {
            $this->finishDelivery($id, NotificationDeliveryStatus::Failed, 'unregistered type');

            return;
        }

        $type = $this->notificationRegistry->type($typeName);
        $verdict = $this->check($type, $row, $now);

        if (EventVerdict::Send !== $verdict) {
            return;
        }

        $audience = Audience::fromArray(self::dict($row['audience']));
        $recipient = ($this->resolvers[$audience->kind->value] ?? null)?->recipient($audience, Uuid::fromString(Type\string()->coerce($row['recipient_id'])));

        if (null === $recipient) {
            $this->finishDelivery($id, NotificationDeliveryStatus::Cancelled, 'no longer in the audience');

            return;
        }

        $channel = NotificationChannel::from(Type\string()->coerce($row['channel']));
        $sender = $this->notificationRegistry->sender($channel);

        if (null === $sender) {
            $this->finishDelivery($id, NotificationDeliveryStatus::Failed, Str\format('nothing sends %s yet', $channel->value));

            return;
        }

        $collapsed = null === $type->collapseKey() ? [] : $this->claimCollapsible($row, $type, $now);
        $payloads = [self::dict($row['payload']), ...Vec\map($collapsed, static fn (array $sibling): array => self::dict($sibling['payload']))];

        try {
            $providerId = $sender->send(Uuid::fromString($id), $recipient, $type->category(), $type->render($channel, $recipient, $payloads), $type->collapseKey());
        } catch (Unreachable $unreachable) {
            if (!$this->forgetIfCancelled($id)) {
                $this->finishDelivery($id, NotificationDeliveryStatus::Failed, $unreachable->getMessage(), attempted: true);
            }

            $this->release($collapsed);

            return;
        } catch (Throwable $failure) {
            $this->failed($id, Type\int()->coerce($row['attempts']) + 1, $failure);
            $this->release($collapsed);

            return;
        }

        $this->finishDelivery($id, NotificationDeliveryStatus::Sent, null, attempted: true, providerId: $providerId);

        foreach ($collapsed as $sibling) {
            $this->connection->executeStatement(
                <<<'SQL'
                    UPDATE notification_deliveries
                    SET status = :sent, collapsed_into = :into, finished_at = :now, claimed_until = NULL
                    WHERE id = :id
                    SQL,
                ['sent' => NotificationDeliveryStatus::Sent->value, 'into' => $id, 'now' => $now, 'id' => $sibling['id']],
                ['now' => Types::DATETIME_IMMUTABLE],
            );
        }
    }

    /** @param array<string, mixed> $row */
    private function check(NotificationTypeInterface $type, array $row, DateTimeImmutable $now): EventVerdict
    {
        $id = Type\string()->coerce($row['id']);

        if ($this->forgetIfCancelled($id)) {
            return EventVerdict::Cancel;
        }

        $sendBy = self::moment($row['send_by']);

        if (null !== $sendBy && $sendBy < $now) {
            $this->finishDelivery($id, NotificationDeliveryStatus::TooLate, 'too late');

            return EventVerdict::Cancel;
        }

        $eventId = Type\nullable(Type\string())->coerce($row['event_id']);
        $event = null === $eventId ? null : $this->eventState($eventId);
        $deleted = null === $eventId ? $this->organisationDeleted($row['organisation_id']) : true === $event?->deleted;
        $verdict = match (true) {
            null !== $eventId => EventGate::verdict($type->eventRule(), $event, $now),
            $deleted => EventVerdict::Hold,
            default => EventVerdict::Send,
        };

        if (EventVerdict::Hold === $verdict) {
            $this->connection->executeStatement(
                'UPDATE notification_deliveries SET held = :held, next_attempt_at = :recheck, claimed_until = NULL WHERE id = :id',
                ['held' => ($deleted ? NotificationHold::Deleted : NotificationHold::Paused)->value, 'recheck' => $now->add(new DateInterval(self::HOLD_RECHECK)), 'id' => $id],
                ['recheck' => Types::DATETIME_IMMUTABLE],
            );

            return $verdict;
        }

        if (EventVerdict::Cancel === $verdict) {
            $this->finishDelivery($id, NotificationDeliveryStatus::Cancelled, 'the event no longer takes it');

            return $verdict;
        }

        if (!$type->isStillDue(self::dict($row['payload']), Uuid::fromString(Type\string()->coerce($row['recipient_id'])))) {
            $this->finishDelivery($id, NotificationDeliveryStatus::Cancelled, 'no longer due');

            return EventVerdict::Cancel;
        }

        return NotificationChannel::Push->value === $row['channel'] ? $this->checkPush($type, $row, $eventId, $sendBy, $now) : EventVerdict::Send;
    }

    /**
     * The selector is asked again at send time, since a night's or a pause's hold gives the member hours to change their mind or read the item (sc-20494).
     *
     * @param array<string, mixed> $row
     */
    private function checkPush(NotificationTypeInterface $type, array $row, ?string $eventId, ?DateTimeImmutable $sendBy, DateTimeImmutable $now): EventVerdict
    {
        $id = Type\string()->coerce($row['id']);
        $recipientId = Uuid::fromString(Type\string()->coerce($row['recipient_id']));
        $category = $type->category();
        $kind = NotificationAudienceKind::from(Type\string()->coerce($row['recipient_kind']));
        $muted = null !== $eventId && NotificationAudienceKind::Member === $kind && [] !== $this->eventMuteRepository->findMutedAmong($eventId, [$recipientId]);

        if (!Iter\contains($this->channelSelector->select($kind, $recipientId, $category, $type->channels(), $muted), NotificationChannel::Push)) {
            $this->finishDelivery($id, NotificationDeliveryStatus::Cancelled, match (true) {
                $muted && $category->heldByMute() => 'event muted',
                !$this->notificationPreferences->allows($recipientId, $category, NotificationChannel::Push) => 'push switched off',
                default => 'push would be the only way they hear',
            });

            return EventVerdict::Cancel;
        }

        $zone = Type\nullable(Type\string())->coerce($this->connection->fetchOne('SELECT timezone FROM users WHERE id = :id', ['id' => $recipientId->toRfc4122()]) ?: null);
        $morning = QuietHours::releaseAt($category, $now, $zone);

        if (null !== $morning) {
            // A second past the limit, so the morning's check finds it too late rather than holding it again.
            $wakeAt = null !== $sendBy && $sendBy < $morning ? $sendBy->add(new DateInterval('PT1S')) : $morning;
            $this->connection->executeStatement(
                'UPDATE notification_deliveries SET held = :held, next_attempt_at = :wake, claimed_until = NULL WHERE id = :id',
                ['held' => NotificationHold::QuietHours->value, 'wake' => $wakeAt, 'id' => $id],
                ['wake' => Types::DATETIME_IMMUTABLE],
            );

            return EventVerdict::Hold;
        }

        $thread = $type->thread(self::dict($row['payload']));
        $item = null !== $thread ? $this->threadItem($row, $thread) : $this->connection->fetchAssociative(
            <<<'SQL'
                SELECT i.id IS NOT NULL AS present, i.read_at IS NOT NULL AS read
                FROM notification_deliveries d
                LEFT JOIN notification_items i ON i.id = COALESCE(d.collapsed_into, d.id)
                WHERE d.type = :type AND d.source_id = :source AND d.recipient_kind = :kind AND d.recipient_id = :recipient
                  AND d.channel = :inApp AND d.status = :sent
                SQL,
            [
                'type' => $row['type'],
                'source' => $row['source_id'],
                'kind' => $row['recipient_kind'],
                'recipient' => $row['recipient_id'],
                'inApp' => NotificationChannel::InApp->value,
                'sent' => NotificationDeliveryStatus::Sent->value,
            ],
        );

        $gone = match (true) {
            false === $item => null,
            !Type\bool()->coerce($item['present']) => 'its item has gone',
            Type\bool()->coerce($item['read']) => 'its item was read',
            default => null,
        };

        if (null !== $gone) {
            $this->finishDelivery($id, NotificationDeliveryStatus::Cancelled, $gone);

            return EventVerdict::Cancel;
        }

        return EventVerdict::Send;
    }

    /**
     * The member's latest item in the thread: a push goes only while it is unread, as it then reads (sc-13214).
     *
     * @param array<string, mixed> $row
     *
     * @return array{present: bool, read: bool}
     */
    private function threadItem(array $row, string $thread): array
    {
        $item = $this->connection->fetchAssociative(
            'SELECT read_at IS NOT NULL AS read FROM notification_items WHERE user_id = :recipient AND thread = :thread ORDER BY read_at IS NOT NULL, created_at DESC LIMIT 1',
            ['recipient' => $row['recipient_id'], 'thread' => $thread],
        );

        return ['present' => false !== $item, 'read' => false !== $item && Type\bool()->coerce($item['read'])];
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return list<array<string, mixed>>
     */
    private function claimCollapsible(array $row, NotificationTypeInterface $type, DateTimeImmutable $now): array
    {
        $ids = $this->connection->fetchFirstColumn(
            <<<'SQL'
                UPDATE notification_deliveries
                SET claimed_at = :now, claimed_until = :lease
                WHERE id IN (
                    SELECT id FROM notification_deliveries
                    WHERE status = :pending
                      AND id <> :id
                      AND recipient_kind = :kind
                      AND recipient_id = :recipient
                      AND channel = :channel
                      AND collapse_key = :collapse
                      AND next_attempt_at <= :now
                      AND (claimed_until IS NULL OR claimed_until < :now)
                    ORDER BY id
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING id
                SQL,
            [
                'now' => $now,
                'lease' => $now->add(new DateInterval(self::LEASE)),
                'pending' => NotificationDeliveryStatus::Pending->value,
                'id' => $row['id'],
                'kind' => $row['recipient_kind'],
                'recipient' => $row['recipient_id'],
                'channel' => $row['channel'],
                'collapse' => $type->collapseKey(),
            ],
            ['now' => Types::DATETIME_IMMUTABLE, 'lease' => Types::DATETIME_IMMUTABLE],
        );

        $collapsible = [];

        foreach (Vec\sort(Vec\map($ids, static fn (mixed $id): string => Type\string()->coerce($id))) as $siblingId) {
            $sibling = $this->delivery($siblingId);
            $siblingType = $this->notificationRegistry->has(Type\string()->coerce($sibling['type']))
                ? $this->notificationRegistry->type(Type\string()->coerce($sibling['type']))
                : null;

            if (null === $siblingType) {
                $this->release([$sibling]);

                continue;
            }

            if (EventVerdict::Send === $this->check($siblingType, $sibling, $now)) {
                $collapsible[] = $sibling;
            }
        }

        return $collapsible;
    }

    private function failed(string $id, int $attempts, Throwable $failure): void
    {
        if ($this->forgetIfCancelled($id)) {
            return;
        }

        $reason = Str\format('%s: %s', $failure::class, $failure->getMessage());

        if ($attempts >= Backoff::ATTEMPTS) {
            $this->finishDelivery($id, NotificationDeliveryStatus::Failed, $reason, attempted: true);
            $this->logger->warning('A notification failed for good after {attempts} attempts.', ['delivery' => $id, 'attempts' => $attempts, 'reason' => $failure::class]);

            return;
        }

        $retryAt = $this->clock->now()->add(new DateInterval(Str\format('PT%dS', Backoff::secondsAfter($attempts, (PseudoRandom\int(0, 2000) - 1000) / 1000))));
        $this->connection->executeStatement(
            <<<'SQL'
                UPDATE notification_deliveries
                SET attempts = :attempts, next_attempt_at = :retry, last_error = :reason, claimed_until = NULL
                WHERE id = :id
                SQL,
            ['attempts' => $attempts, 'retry' => $retryAt, 'reason' => $reason, 'id' => $id],
            ['retry' => Types::DATETIME_IMMUTABLE],
        );
    }

    /** @param list<array<string, mixed>> $rows */
    private function release(array $rows): void
    {
        foreach ($rows as $row) {
            if (!$this->forgetIfCancelled(Type\string()->coerce($row['id']))) {
                $this->connection->executeStatement('UPDATE notification_deliveries SET claimed_until = NULL WHERE id = :id', ['id' => $row['id']]);
            }
        }
    }

    /** A cancel leaves the call under way to finish (sc-104, "a cancel during a send"): any attempt that does not end Sent goes with the rest. */
    private function forgetIfCancelled(string $id): bool
    {
        return 0 < $this->connection->executeStatement(
            <<<'SQL'
                DELETE FROM notification_deliveries
                WHERE id = :id
                  AND scheduled_notification_id IN (
                      SELECT id FROM scheduled_notifications WHERE status = :cancelled AND outcome = :byKey
                  )
                SQL,
            ['id' => $id, 'cancelled' => ScheduledNotificationStatus::Cancelled->value, 'byKey' => NotificationScheduler::CANCELLED_BY_KEY],
        );
    }

    private function finishDelivery(string $id, NotificationDeliveryStatus $status, ?string $reason, bool $attempted = false, ?string $providerId = null): void
    {
        $this->connection->executeStatement(
            <<<'SQL'
                UPDATE notification_deliveries
                SET status = :status,
                    last_error = COALESCE(:reason, last_error),
                    attempts = attempts + :attempted,
                    provider_message_id = :provider,
                    held = NULL,
                    finished_at = :now,
                    claimed_until = NULL
                WHERE id = :id
                SQL,
            [
                'status' => $status->value,
                'reason' => $reason,
                'attempted' => $attempted ? 1 : 0,
                'provider' => $providerId,
                'now' => $this->clock->now(),
                'id' => $id,
            ],
            ['now' => Types::DATETIME_IMMUTABLE],
        );
    }

    private function finishScheduled(string $id, ScheduledNotificationStatus $status, ?string $outcome): void
    {
        $this->connection->executeStatement(
            <<<'SQL'
                UPDATE scheduled_notifications
                SET status = :status, outcome = :outcome, held = NULL, finished_at = :now, claimed_until = NULL
                WHERE id = :id AND status = :pending
                SQL,
            ['status' => $status->value, 'outcome' => $outcome, 'now' => $this->clock->now(), 'id' => $id, 'pending' => ScheduledNotificationStatus::Pending->value],
            ['now' => Types::DATETIME_IMMUTABLE],
        );
    }

    /** @return array<string, mixed> */
    private function delivery(string $id): array
    {
        $row = $this->connection->fetchAssociative(
            <<<'SQL'
                SELECT d.id, d.type, d.source_id, d.event_id, d.recipient_kind, d.recipient_id, d.channel, d.send_by, d.attempts, s.organisation_id, s.audience, s.payload
                FROM notification_deliveries d
                JOIN scheduled_notifications s ON s.id = d.scheduled_notification_id
                WHERE d.id = :id
                SQL,
            ['id' => $id],
        );

        return false === $row ? throw new LogicException('A claimed delivery has gone.') : $row;
    }

    private function organisationDeleted(mixed $organisationId): bool
    {
        return null !== $organisationId && true === Type\bool()->coerce($this->connection->fetchOne(
            'SELECT deleted_at IS NOT NULL FROM organisations WHERE id = :id',
            ['id' => $organisationId],
        ));
    }

    /** Past the soft-delete filter, so that a deleted event's deletion notices can still go (sc-13214). */
    private function eventState(string $eventId): ?EventState
    {
        $row = $this->connection->fetchAssociative(
            <<<'SQL'
                SELECT e.status, e.starts_at_utc, e.ends_at_utc, e.ended_at, (e.deleted_at IS NOT NULL OR o.deleted_at IS NOT NULL) AS deleted
                FROM events e
                JOIN organisations o ON o.id = e.organisation_id
                WHERE e.id = :id
                SQL,
            ['id' => $eventId],
        );

        if (false === $row) {
            return null;
        }

        return new EventState(
            EventStatus::from(Type\string()->coerce($row['status'])),
            self::moment($row['starts_at_utc']) ?? throw new LogicException('An event has no start.'),
            self::moment($row['ends_at_utc']) ?? throw new LogicException('An event has no end.'),
            self::moment($row['ended_at']),
            Type\bool()->coerce($row['deleted']),
        );
    }

    private static function moment(mixed $stored): ?DateTimeImmutable
    {
        return null === $stored ? null : new DateTimeImmutable(Type\string()->coerce($stored), new DateTimeZone('UTC'));
    }

    /** @return array<string, mixed> */
    private static function dict(mixed $json): array
    {
        return Json\typed(Type\string()->coerce($json), Type\dict(Type\string(), Type\mixed()));
    }
}
