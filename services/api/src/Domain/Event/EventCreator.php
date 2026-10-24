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

    /** @param array{name: ?string, startsAt: ?string, endsAt: ?string, timeZone: ?string, currency: ?string} $fields zone and currency default to the organisation's */
    public function create(Organisation $organisation, User $by, array $fields): Event
    {
        $checked = $this->eventRules->check([
            'name' => $fields['name'],
            'startsAt' => $fields['startsAt'],
            'endsAt' => $fields['endsAt'],
            'timeZone' => $fields['timeZone'] ?? $organisation->getTimezone(),
            'currency' => $fields['currency'] ?? $organisation->getCurrency(),
        ]);

        $event = new Event($organisation, $checked['name'], $checked['startsAt'], $checked['endsAt'], $checked['currency']);
        $this->entityManager->persist($event);

        $this->auditor->record(self::CREATED, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), [
            'organisation' => [null, $organisation->getId()->toRfc4122()],
            'name' => [null, $event->getName()],
            'startsAt' => [null, $event->getStartsAt()->format(\DATE_ATOM)],
            'endsAt' => [null, $event->getEndsAt()->format(\DATE_ATOM)],
            'timeZone' => [null, $event->getTimeZone()],
            'currency' => [null, $event->getCurrency()],
        ]);

        $this->entityManager->flush();

        return $event;
    }
}
