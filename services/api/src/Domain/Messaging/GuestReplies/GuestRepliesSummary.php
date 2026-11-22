<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestReplies;

use App\Domain\Messaging\Audience\MemberAudienceResolver;
use App\Domain\Messaging\Interfaces\MealsNotChosenInterface;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Entity\Event;
use App\Enum\NotificationChannel;
use App\Enum\NotificationDeliveryStatus;
use App\Enum\NotificationPriority;
use App\Enum\Permission;
use App\Repository\EventMuteRepository;
use Closure;
use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\EntityManagerInterface;
use LogicException;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\DependencyInjection\Attribute\AutowireServiceClosure;
use Symfony\Component\Uid\Uuid;

/** The morning's summary (AC 6 to 9): per event the member still sees and has not muted, what is unseen since the last one; with nothing unseen it is not sent. */
final readonly class GuestRepliesSummary extends GuestRepliesType
{
    public const string NAME = 'guest_replies.summary';

    /** An event's section adds who is not seated and who has not chosen a meal from this long before it starts. */
    public const string EVENT_WEEK = 'P7D';

    public function __construct(
        private Connection $connection,
        private EntityManagerInterface $entityManager,
        private GuestReplyLog $guestReplyLog,
        private GuestReplyWording $guestReplyWording,
        private GuestRepliesUnsubscribe $guestRepliesUnsubscribe,
        /** @var Closure(): MemberAudienceResolver resolved only when a summary is rendered, so the registry builds without the access layer */
        #[AutowireServiceClosure(MemberAudienceResolver::class)]
        private Closure $memberAudienceResolver,
        private EventMuteRepository $eventMuteRepository,
        private MealsNotChosenInterface $mealsNotChosen,
        private ClockInterface $clock,
        #[Autowire(env: 'CORS_WEB_ORIGIN')]
        private string $webOrigin,
    ) {
    }

    public function name(): string
    {
        return self::NAME;
    }

    public function priority(): NotificationPriority
    {
        return NotificationPriority::Normal;
    }

    public function channels(): array
    {
        return [NotificationChannel::Email];
    }

    public function collapseKey(array $payload): ?string
    {
        return null;
    }

    public function thread(array $payload): ?string
    {
        return null;
    }

    public function isStillDue(array $payload, ?Uuid $recipient = null): bool
    {
        return null === $recipient || [] !== $this->sections(self::organisationId($payload), $recipient);
    }

    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $organisationId = self::organisationId(Iter\last($payloads));
        $sections = $this->sections($organisationId, $recipient->id);
        if ([] === $sections) {
            throw new LogicException('Nothing unseen is left after it was found still due.');
        }

        $first = $sections[0];
        $locale = $recipient->locale;
        $zone = $this->zoneOf($recipient->id);
        $origin = Str\trim_right($this->webOrigin, '/');
        $since = $this->lastSummaryAt($organisationId, $recipient->id) ?? Iter\last($first['tally']->rows)?->at ?? $this->clock->now();

        foreach ($sections as $section) {
            $oldest = Iter\last($section['tally']->rows)?->at;
            $since = null !== $oldest && $oldest < $since ? $oldest : $since;
        }

        $body = [
            $this->guestReplyWording->line('guestReplies.email.heading', [], $locale),
            '',
            $this->guestReplyWording->line('guestReplies.email.opening', ['date' => $this->guestReplyWording->date($since, $zone, $locale)], $locale),
        ];

        foreach ($sections as $section) {
            $body = [...$body, '', ...$this->section($section['event'], $section['tally'], $locale, $origin)];
        }

        $body = [
            ...$body,
            '',
            $this->guestReplyWording->line('guestReplies.email.footer', ['organisation' => $first['event']->getOrganisation()->getName()], $locale),
            $this->link('guestReplies.email.turnOff', $this->guestRepliesUnsubscribe->url($recipient->id), $locale),
            $this->link('guestReplies.email.settings', $origin . '/app/account/notifications', $locale),
        ];

        return new RenderedNotification(
            $this->subject($sections, $locale),
            Str\join($body, "\n"),
            unsubscribe: $this->guestRepliesUnsubscribe->url($recipient->id),
        );
    }

    /** @param non-empty-list<array{event: Event, tally: Model\GuestReplyTally}> $sections */
    private function subject(array $sections, string $locale): string
    {
        $replying = Vec\filter($sections, static fn (array $section): bool => $section['tally']->replies() > 0);
        $replies = Iter\reduce($replying, static fn (int $sum, array $section): int => $sum + $section['tally']->replies(), 0);
        $event = $sections[0]['event']->getName();

        return match (true) {
            1 === Iter\count($replying) => $this->guestReplyWording->line('guestReplies.email.subject.event', ['event' => $replying[0]['event']->getName(), 'count' => $replies], $locale),
            $replies > 0 => $this->guestReplyWording->line('guestReplies.email.subject.events', ['count' => $replies], $locale),
            1 === Iter\count($sections) => $this->guestReplyWording->line('guestReplies.email.subject.eventSummary', ['event' => $event], $locale),
            default => $this->guestReplyWording->line('guestReplies.email.subject.eventsSummary', [], $locale),
        };
    }

    /** @return list<string> */
    private function section(Event $event, Model\GuestReplyTally $tally, string $locale, string $origin): array
    {
        $eventId = $event->getId()->toRfc4122();
        $lines = [$event->getName(), $this->guestReplyWording->date($event->getStartsAt(), $event->getTimeZone(), $locale)];
        $counts = $tally->byCount();

        foreach (['coming', 'notComing', 'maybe', 'changed'] as $count) {
            if (isset($counts[$count])) {
                $lines[] = $this->guestReplyWording->line('guestReplies.email.count.' . $count, ['count' => Iter\count($counts[$count])], $locale);
                $lines[] = $this->guestReplyWording->names($counts[$count], $locale);
            }
        }

        $waiting = $this->stillWaiting($eventId);

        if ($waiting > 0) {
            $lines[] = $this->guestReplyWording->line('guestReplies.email.waiting', ['count' => $waiting], $locale);
            $replyBy = $event->getReplyBy();

            if (null !== $replyBy) {
                $closes = new DateTimeImmutable($replyBy->format('Y-m-d') . ' 23:59:59', new DateTimeZone($event->getTimeZone()));
                $key = $this->clock->now() >= $closes ? 'guestReplies.email.repliesClosed' : 'guestReplies.email.repliesClose';
                $lines[] = $this->guestReplyWording->line($key, ['replyBy' => $this->guestReplyWording->date($closes, $event->getTimeZone(), $locale)], $locale);
            }
        }

        if (isset($counts['needs'])) {
            $lines[] = $this->guestReplyWording->line('guestReplies.email.needs', [], $locale);
            $lines[] = $this->guestReplyWording->names($counts['needs'], $locale);
        }

        if (isset($counts['flagged'])) {
            $lines[] = $this->guestReplyWording->line('guestReplies.email.flagged', [], $locale);
            $lines[] = $this->guestReplyWording->names($counts['flagged'], $locale);
            $lines[] = $this->guestReplyWording->line('guestReplies.email.flaggedFix', [], $locale);
        }

        $eventWeek = $this->inEventWeek($event);
        $unseated = $eventWeek ? $this->notSeated($eventId) : 0;
        $unchosen = $eventWeek ? Iter\count($this->mealsNotChosen->people($event)) : 0;

        if ($unseated > 0) {
            $lines[] = $this->guestReplyWording->line('guestReplies.email.notSeated', ['count' => $unseated], $locale);
        }

        if ($unchosen > 0) {
            $lines[] = $this->guestReplyWording->line('guestReplies.email.noMealChosen', ['count' => $unchosen], $locale);
        }

        $lines[] = $this->link('guestReplies.email.openGuestList', $origin . '/app/events/' . $eventId . '/guests', $locale);

        return $lines;
    }

    /** @return list<array{event: Event, tally: Model\GuestReplyTally}> soonest event first */
    private function sections(Uuid $organisationId, Uuid $userId): array
    {
        $last = $this->lastSummaryAt($organisationId, $userId);
        $eventIds = $this->connection->fetchFirstColumn(
            <<<'SQL'
                SELECT DISTINCT c.event_id
                FROM guest_reply_changes c
                JOIN events e ON e.id = c.event_id
                WHERE e.organisation_id = :organisation AND (CAST(:last AS TIMESTAMP) IS NULL OR c.created_at >= :last)
                SQL,
            ['organisation' => $organisationId->toRfc4122(), 'last' => $last],
            ['last' => Types::DATETIME_IMMUTABLE],
        );
        $sections = [];

        foreach ($eventIds as $eventId) {
            $eventId = Type\string()->coerce($eventId);
            $event = $this->entityManager->find(Event::class, $eventId);

            if (null === $event || !$this->canSee($organisationId, $event, $userId) || [] !== $this->eventMuteRepository->findMutedAmong($eventId, [$userId])) {
                continue;
            }

            $looked = $this->guestReplyLog->lookedAt($userId, $eventId);
            $from = null === $last || (null !== $looked && $looked > $last) ? $looked : $last;
            $tally = $this->guestReplyLog->after($eventId, $from);

            if (!$tally->isEmpty()) {
                $sections[] = ['event' => $event, 'tally' => $tally];
            }
        }

        return Vec\sort_by($sections, static fn (array $section): int => $section['event']->getStartsAt()->getTimestamp());
    }

    private function canSee(Uuid $organisationId, Event $event, Uuid $userId): bool
    {
        return null !== ($this->memberAudienceResolver)()->recipient(Audience::memberOfEvent($organisationId, $event->getId(), Permission::GuestsRead, $userId), $userId);
    }

    private function lastSummaryAt(Uuid $organisationId, Uuid $userId): ?DateTimeImmutable
    {
        $at = $this->connection->fetchOne(
            <<<'SQL'
                SELECT MAX(d.finished_at)
                FROM notification_deliveries d
                JOIN scheduled_notifications s ON s.id = d.scheduled_notification_id
                WHERE d.type = :type AND d.recipient_id = :user AND d.status = :sent AND s.organisation_id = :organisation
                SQL,
            ['type' => self::NAME, 'user' => $userId->toRfc4122(), 'sent' => NotificationDeliveryStatus::Sent->value, 'organisation' => $organisationId->toRfc4122()],
        );

        return null === $at || false === $at ? null : new DateTimeImmutable(Type\string()->coerce($at), new DateTimeZone('UTC'));
    }

    private function stillWaiting(string $eventId): int
    {
        return Type\int()->coerce($this->connection->fetchOne(
            <<<'SQL'
                SELECT COUNT(*) FROM guests
                WHERE event_id = :event AND host_id IS NULL AND removed_at IS NULL AND invited_at IS NOT NULL AND (reply IS NULL OR reply = 'noReply')
                SQL,
            ['event' => $eventId],
        ));
    }

    /** Coming guests and their companions with no seat, once the event has a seating plan. */
    private function notSeated(string $eventId): int
    {
        return Type\int()->coerce($this->connection->fetchOne(
            <<<'SQL'
                SELECT COUNT(*) FROM guests g
                LEFT JOIN guests h ON h.id = g.host_id
                WHERE g.event_id = :event AND g.removed_at IS NULL
                  AND COALESCE(h.reply, g.reply) = 'coming'
                  AND EXISTS (SELECT 1 FROM seating_plans p WHERE p.event_id = :event)
                  AND NOT EXISTS (SELECT 1 FROM seat_assignments a WHERE a.event_id = :event AND a.guest_id = g.id)
                SQL,
            ['event' => $eventId],
        ));
    }

    private function inEventWeek(Event $event): bool
    {
        $now = $this->clock->now();

        return $now < $event->getStartsAt() && $now >= $event->getStartsAt()->sub(new DateInterval(self::EVENT_WEEK));
    }

    private function zoneOf(Uuid $userId): string
    {
        return Type\nullable(Type\string())->coerce($this->connection->fetchOne('SELECT timezone FROM users WHERE id = :id', ['id' => $userId->toRfc4122()]) ?: null) ?? 'UTC';
    }

    private function link(string $label, string $url, string $locale): string
    {
        return $this->guestReplyWording->line('guestReplies.email.link', ['label' => $this->guestReplyWording->line($label, [], $locale), 'url' => $url], $locale);
    }

    /** @param array<string, mixed> $payload */
    private static function organisationId(array $payload): Uuid
    {
        return Uuid::fromString(Type\string()->coerce($payload['organisationId'] ?? ''));
    }
}
