<?php

declare(strict_types=1);

namespace App\Domain\Event\CalendarFeed;

use DateTimeImmutable;
use DateTimeZone;
use Psl\Str;
use Psl\Str\Byte;
use Psl\Vec;

/** RFC 5545's content lines: text escaped (§3.3.11), times written (§3.3.5), and each line folded at 75 octets and ended in CRLF (§3.1). */
final class ICalendarLines
{
    private const int OCTETS = 75;

    public static function text(string $value): string
    {
        return Str\replace_every($value, ['\\' => '\\\\', ';' => '\;', ',' => '\,', "\r\n" => '\n', "\n" => '\n', "\r" => '\n']);
    }

    public static function utc(DateTimeImmutable $at): string
    {
        return $at->setTimezone(new DateTimeZone('UTC'))->format('Ymd\THis\Z');
    }

    /** The wall-clock time in the zone, for a property carrying `;TZID=`. */
    public static function local(DateTimeImmutable $at, DateTimeZone $zone): string
    {
        return $at->setTimezone($zone)->format('Ymd\THis');
    }

    /** @param list<string> $lines */
    public static function join(array $lines): string
    {
        return Str\join(Vec\map($lines, self::fold(...)), "\r\n") . "\r\n";
    }

    /** Never inside a UTF-8 sequence, so a multi-octet letter at the 75th octet moves whole to the next line. */
    public static function fold(string $line): string
    {
        $folded = [];
        $current = '';
        $limit = self::OCTETS;

        foreach (Str\chunk($line) as $character) {
            if (Byte\length($current) + Byte\length($character) > $limit) {
                $folded[] = $current;
                $current = '';
                $limit = self::OCTETS - 1;
            }

            $current .= $character;
        }

        $folded[] = $current;

        return Str\join($folded, "\r\n ");
    }
}
