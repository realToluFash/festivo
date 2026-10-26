<?php

declare(strict_types=1);

namespace App\Domain\Event\Http;

use App\Domain\Event\EventDayCount;
use App\Entity\Event;
use DateTimeZone;

final class EventSerialiser
{
    /** @return array{id: string, organisationId: string, name: string, type: string, status: string, startsAt: string, endsAt: string, timeZone: string, dayCount: int, currency: string, createdAt: string} */
    public static function event(Event $event): array
    {
        return [
            'id' => $event->getId()->toRfc4122(),
            'organisationId' => $event->getOrganisation()->getId()->toRfc4122(),
            'name' => $event->getName(),
            'type' => $event->getType()->value,
            'status' => $event->getStatus()->value,
            'startsAt' => $event->getStartsAt()->format(\DATE_ATOM),
            'endsAt' => $event->getEndsAt()->format(\DATE_ATOM),
            'timeZone' => $event->getTimeZone(),
            'dayCount' => EventDayCount::of($event->getStartsAt(), $event->getEndsAt(), new DateTimeZone($event->getTimeZone())),
            'currency' => $event->getCurrency(),
            'createdAt' => $event->getCreatedAt()->format(\DATE_ATOM),
        ];
    }
}
