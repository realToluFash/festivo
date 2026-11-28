<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Handover;

use App\Domain\Organisation\Handover\Model\WorkKind;
use App\Entity\Event;
use App\Entity\EventPerson;
use App\Entity\Membership;
use App\Enum\EventStatus;
use App\Repository\EventPersonRepository;
use DateTimeImmutable;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** What a member is responsible for, and so what leaves with them (sc-614): today the events they lead, in any state. */
final readonly class WorkFinder
{
    public function __construct(
        private EventPersonRepository $eventPersonRepository,
        private ClockInterface $clock,
    ) {
    }

    /** @return list<Event> soonest first: events not yet over by start, then those whose end has passed or that were ended or called off, most recent first */
    public function heldBy(Membership $membership): array
    {
        $events = [];

        foreach (ResponsibleFields::all() as $kind) {
            $events = [...$events, ...match ($kind) {
                WorkKind::EventLead => Vec\map($this->eventPersonRepository->findLedBy($membership), static fn (EventPerson $person): Event => $person->getEvent()),
            }];
        }

        return self::soonestFirst($events, $this->clock->now());
    }

    /**
     * @param list<Event> $events
     *
     * @return list<Event>
     */
    public static function soonestFirst(array $events, DateTimeImmutable $now): array
    {
        $over = static fn (Event $event): bool => EventStatus::Ended === $event->getStatus() || $event->getEndsAt() <= $now;
        $byStart = static fn (Event $a, Event $b): int => [$a->getStartsAt(), $a->getId()->toRfc4122()] <=> [$b->getStartsAt(), $b->getId()->toRfc4122()];

        return [
            ...Vec\sort(Vec\filter($events, static fn (Event $event): bool => !$over($event)), $byStart),
            ...Vec\sort(Vec\filter($events, $over), static fn (Event $a, Event $b): int => $byStart($b, $a)),
        ];
    }
}
