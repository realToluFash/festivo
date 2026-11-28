<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestReplies;

use App\Domain\Messaging\Audience\MemberAudienceResolver;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Trigger;
use App\Domain\Messaging\NotificationScheduler;
use App\Entity\Guest;
use App\Enum\GuestChangeKind;
use App\Enum\GuestReply;
use App\Enum\Permission;
use App\Enum\ScheduledNotificationStatus;
use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** Tells an event's members with guests.read what a guest did (sc-4331): the bell at once, a push at most once an hour per event, and the morning's summary. Call it inside the change's own transaction. */
final readonly class GuestReplyRecorder
{
    /** At most one push per event per member in this long. */
    public const string PUSH_EVERY = 'PT1H';

    /** The summary goes at this hour in the member's own zone. */
    public const int SUMMARY_HOUR = 8;

    public function __construct(
        private Connection $connection,
        private NotificationScheduler $notificationScheduler,
        private MemberAudienceResolver $memberAudienceResolver,
        private ClockInterface $clock,
    ) {
    }

    /** A first reply, or a changed one, its companions included. Either side of the guest list counts: the guest's page and a reply a host recorded for them. */
    public function replied(Guest $guest, ?GuestReply $before): void
    {
        $kind = null === $before || GuestReply::NoReply === $before ? GuestChangeKind::Replied : GuestChangeKind::Changed;
        $this->record($guest, $kind, $guest->getReply());
    }

    /** A guest's own needs, which a companion's count for the guest who brought them. */
    public function needs(Guest $person): void
    {
        $this->record($person->getHost() ?? $person, GuestChangeKind::Needs, null);
    }

    public function flagged(Guest $guest): void
    {
        $this->record($guest, GuestChangeKind::Flagged, null);
    }

    private function record(Guest $guest, GuestChangeKind $kind, ?GuestReply $answer): void
    {
        $now = $this->clock->now();
        $event = $guest->getEvent();
        $eventId = $event->getId()->toRfc4122();
        $organisationId = $event->getOrganisation()->getId();
        $id = Uuid::v7();
        $this->connection->insert('guest_reply_changes', [
            'id' => $id->toRfc4122(),
            'event_id' => $eventId,
            'guest_id' => $guest->getId()->toRfc4122(),
            'kind' => $kind->value,
            'answer' => $answer?->value,
            'created_at' => $now,
        ], ['created_at' => Types::DATETIME_IMMUTABLE]);

        $source = 'guest-reply:' . $id->toRfc4122();
        $audience = Audience::membersOfEvent($organisationId, $event->getId(), Permission::GuestsRead);
        $this->notificationScheduler->schedule(GuestRepliesItem::NAME, GuestRepliesItem::NAME . ':' . $id->toRfc4122(), $source, Trigger::at($now), $audience, ['eventId' => $eventId], $event);

        if (!$this->pushPending($eventId)) {
            $dueAt = $this->nextPushAt($eventId, $now);
            $this->notificationScheduler->schedule(
                GuestRepliesPush::NAME,
                GuestRepliesPush::NAME . ':' . $eventId . ':' . $dueAt->format('U'),
                'guest-replies-push:' . $eventId . ':' . $dueAt->format('U'),
                Trigger::at($dueAt),
                $audience,
                ['eventId' => $eventId, 'from' => $now->format(\DATE_ATOM)],
                $event,
            );
        }

        $this->summariesFor($organisationId, $this->members($audience), $now);
    }

    private function pushPending(string $eventId): bool
    {
        return false !== $this->connection->fetchOne(
            'SELECT 1 FROM scheduled_notifications WHERE type = :type AND event_id = :event AND status = :pending',
            ['type' => GuestRepliesPush::NAME, 'event' => $eventId, 'pending' => ScheduledNotificationStatus::Pending->value],
        );
    }

    /** The first change in an hour pushes now; one after it waits for the hour to be up, and every change until then joins it. */
    private function nextPushAt(string $eventId, DateTimeImmutable $now): DateTimeImmutable
    {
        $last = $this->connection->fetchOne(
            'SELECT MAX(due_at) FROM scheduled_notifications WHERE type = :type AND event_id = :event',
            ['type' => GuestRepliesPush::NAME, 'event' => $eventId],
        );

        if (null === $last || false === $last) {
            return $now;
        }

        $next = new DateTimeImmutable(Type\string()->coerce($last), new DateTimeZone('UTC'))->add(new DateInterval(self::PUSH_EVERY));

        return $next > $now ? $next : $now;
    }

    /** @param list<Uuid> $members each gets one summary a morning per organisation; every event in it is checked for access when it goes, so losing one leaves the others */
    private function summariesFor(Uuid $organisationId, array $members, DateTimeImmutable $now): void
    {
        if ([] === $members) {
            return;
        }

        $ids = Vec\map($members, static fn (Uuid $member): string => $member->toRfc4122());
        $zones = Type\dict(Type\string(), Type\nullable(Type\string()))->coerce($this->connection->fetchAllKeyValue(
            'SELECT id, timezone FROM users WHERE id IN (:ids)',
            ['ids' => $ids],
            ['ids' => ArrayParameterType::STRING],
        ));
        $due = [];

        foreach ($members as $member) {
            $zone = $zones[$member->toRfc4122()] ?? null;
            $zone = '' === $zone ? null : $zone;
            $dueAt = self::morningAfter($now, $zone);
            $day = $dueAt->setTimezone(new DateTimeZone($zone ?? 'UTC'))->format('Y-m-d');
            $due[GuestRepliesSummary::NAME . ':' . $organisationId->toRfc4122() . ':' . $member->toRfc4122() . ':' . $day] = [$member, $dueAt];
        }

        $queued = Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(
            'SELECT cancellation_key FROM scheduled_notifications WHERE cancellation_key IN (:keys) AND status = :pending',
            ['keys' => Vec\keys($due), 'pending' => ScheduledNotificationStatus::Pending->value],
            ['keys' => ArrayParameterType::STRING],
        ));

        foreach ($due as $key => [$member, $dueAt]) {
            if (Iter\contains($queued, $key)) {
                continue;
            }

            $this->notificationScheduler->schedule(
                GuestRepliesSummary::NAME,
                $key,
                $key,
                Trigger::at($dueAt),
                Audience::members($organisationId, [$member]),
                ['organisationId' => $organisationId->toRfc4122()],
            );
        }
    }

    /** The next 08:00 in the zone, in UTC. */
    public static function morningAfter(DateTimeImmutable $now, ?string $zone): DateTimeImmutable
    {
        $local = $now->setTimezone(new DateTimeZone($zone ?? 'UTC'));
        $morning = $local->setTime(self::SUMMARY_HOUR, 0);

        return ($morning > $local ? $morning : $morning->modify('+1 day'))->setTimezone(new DateTimeZone('UTC'));
    }

    /** @return list<Uuid> */
    private function members(Audience $audience): array
    {
        $members = [];

        do {
            $page = $this->memberAudienceResolver->resolve($audience, Iter\last($members), 500);
            $members = [...$members, ...$page];
        } while ([] !== $page);

        return $members;
    }
}
