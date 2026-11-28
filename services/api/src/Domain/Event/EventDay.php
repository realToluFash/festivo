<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Entity\Event;
use App\Enum\EventDayRefusal;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Str;
use Psr\Clock\ClockInterface;

/** A typed day before the event: not before today and before the day the event starts, both read in the event's zone. */
final class EventDay
{
    public static function before(Event $event, string $typed, ClockInterface $clock): DateTimeImmutable|EventDayRefusal
    {
        $zone = new DateTimeZone($event->getTimeZone());
        $day = DateTimeImmutable::createFromFormat('!Y-m-d', Str\trim($typed), new DateTimeZone('UTC'));

        if (false === $day || $day->format('Y-m-d') !== Str\trim($typed)) {
            return EventDayRefusal::Invalid;
        }

        if ($day->format('Y-m-d') < $clock->now()->setTimezone($zone)->format('Y-m-d')) {
            return EventDayRefusal::Past;
        }

        if ($day->format('Y-m-d') >= $event->getStartsAt()->setTimezone($zone)->format('Y-m-d')) {
            return EventDayRefusal::NotBeforeEvent;
        }

        return $day;
    }
}
