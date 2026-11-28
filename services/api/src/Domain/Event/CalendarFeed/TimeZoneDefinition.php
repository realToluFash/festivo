<?php

declare(strict_types=1);

namespace App\Domain\Event\CalendarFeed;

use DateTimeImmutable;
use DateTimeZone;
use Psl\Math;
use Psl\Str;

/**
 * A zone's VTIMEZONE (RFC 5545 §3.6.5), written from the zone's own transitions between two instants, so the offsets a calendar app applies are the ones PHP gave the event. The first observance starts at the span's start, at the offset then in force.
 */
final class TimeZoneDefinition
{
    /** @return list<string> */
    public static function lines(DateTimeZone $zone, DateTimeImmutable $from, DateTimeImmutable $to): array
    {
        $transitions = $zone->getTransitions($from->getTimestamp(), $to->getTimestamp());
        $lines = ['BEGIN:VTIMEZONE', 'TZID:' . $zone->getName()];

        if (false === $transitions || [] === $transitions) {
            $offset = $zone->getOffset($from);

            return [...$lines, ...self::observance(false, $from->setTimezone($zone)->format('Ymd\THis'), $offset, $offset, $from->setTimezone($zone)->format('T')), 'END:VTIMEZONE'];
        }

        $previous = $transitions[0]['offset'];

        foreach ($transitions as $index => $transition) {
            $offset = $transition['offset'];

            if (0 === $index) {
                $onset = $from->setTimezone($zone)->format('Ymd\THis');
            } else {
                $onset = new DateTimeImmutable('@' . $transition['ts'])->modify(($previous >= 0 ? '+' : '-') . Math\abs($previous) . ' seconds')->format('Ymd\THis');
            }

            $lines = [...$lines, ...self::observance($transition['isdst'], $onset, $previous, $offset, $transition['abbr'])];
            $previous = $offset;
        }

        return [...$lines, 'END:VTIMEZONE'];
    }

    /** @return list<string> */
    private static function observance(bool $daylight, string $onset, int $from, int $to, string $name): array
    {
        $kind = $daylight ? 'DAYLIGHT' : 'STANDARD';

        return [
            'BEGIN:' . $kind,
            'DTSTART:' . $onset,
            'TZOFFSETFROM:' . self::offset($from),
            'TZOFFSETTO:' . self::offset($to),
            'TZNAME:' . ICalendarLines::text($name),
            'END:' . $kind,
        ];
    }

    private static function offset(int $seconds): string
    {
        $sign = $seconds < 0 ? '-' : '+';
        $seconds = Math\abs($seconds);
        $hours = Math\div($seconds, 3600);
        $minutes = Math\div($seconds % 3600, 60);
        $rest = $seconds % 60;

        return $sign . Str\format('%02d%02d', $hours, $minutes) . (0 === $rest ? '' : Str\format('%02d', $rest));
    }
}
