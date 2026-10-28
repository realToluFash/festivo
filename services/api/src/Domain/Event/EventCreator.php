<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Audit\Auditor;
use App\Entity\Event;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use Doctrine\ORM\EntityManagerInterface;

final readonly class EventCreator
{
    public const string CREATED = 'event.created';

    public function __construct(
        private EventRules $eventRules,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
    ) {
    }

    /** @param array{name: ?string, type: ?string, startsAt: ?string, endsAt: ?string, timeZone: ?string, currency: ?string, venue: array{name?: ?string, address?: ?string, addressId?: ?string}|null} $fields zone and currency default to the organisation's */
    public function create(Organisation $organisation, User $by, array $fields): Event
    {
        $checked = $this->eventRules->check([
            'name' => $fields['name'],
            'type' => $fields['type'],
            'startsAt' => $fields['startsAt'],
            'endsAt' => $fields['endsAt'],
            'timeZone' => $fields['timeZone'] ?? $organisation->getTimezone(),
            'currency' => $fields['currency'] ?? $organisation->getCurrency(),
            'venue' => $fields['venue'],
        ]);

        $event = new Event($organisation, $checked['name'], $checked['type'], $checked['startsAt'], $checked['endsAt'], $checked['currency']);
        EventVenue::write($event, $checked['venue'] ?? null);
        $this->entityManager->persist($event);

        $this->auditor->record(self::CREATED, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), self::recorded($event));

        $this->entityManager->flush();

        return $event;
    }

    /** @return array<string, array{0: mixed, 1: mixed}> */
    public static function recorded(Event $event): array
    {
        return [
            'organisation' => [null, $event->getOrganisation()->getId()->toRfc4122()],
            'name' => [null, $event->getName()],
            'type' => [null, $event->getType()->value],
            'startsAt' => [null, $event->getStartsAt()->format(\DATE_ATOM)],
            'endsAt' => [null, $event->getEndsAt()->format(\DATE_ATOM)],
            'timeZone' => [null, $event->getTimeZone()],
            'currency' => [null, $event->getCurrency()],
            ...Auditor::diff([], EventEditor::venueRecorded($event)),
        ];
    }
}
