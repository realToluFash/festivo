<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Domain\Event\LocalTimeResolver;
use App\Entity\Event;
use App\Entity\StaffShift;
use App\Locale\SupportedLocales;
use DateTimeImmutable;
use DateTimeZone;
use IntlDateFormatter;
use IntlDatePatternGenerator;
use Psl\Math;
use Psl\Regex;
use Psl\Str;
use Symfony\Contracts\Translation\TranslatorInterface;

/** A shift's times: entered and kept as wall-clock times in the event's zone (sc-98), compared as the instants they name, and written as sc-3908 has them. */
final readonly class ShiftClock
{
    private const string WALL = '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/';

    private const int DAY = 86_400;

    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /** `2026-11-07T16:00`, as if in UTC, or null when it is not one. */
    public static function wall(string $typed): ?DateTimeImmutable
    {
        $typed = Str\trim($typed);

        if (!Regex\matches($typed, self::WALL)) {
            return null;
        }

        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i', $typed, new DateTimeZone('UTC'));

        return false === $parsed || $parsed->format('Y-m-d\TH:i') !== $typed ? null : $parsed;
    }

    public static function instant(DateTimeImmutable $wall, Event $event): DateTimeImmutable
    {
        return LocalTimeResolver::resolve($wall, new DateTimeZone($event->getTimeZone()));
    }

    public static function seconds(DateTimeImmutable $from, DateTimeImmutable $to, Event $event): int
    {
        return self::instant($to, $event)->getTimestamp() - self::instant($from, $event)->getTimestamp();
    }

    public static function overlaps(StaffShift $shift, DateTimeImmutable $startsAt, DateTimeImmutable $endsAt): bool
    {
        $event = $shift->getJob()->getEvent();

        return self::instant($shift->getStartsAt(), $event) < self::instant($endsAt, $event)
            && self::instant($startsAt, $event) < self::instant($shift->getEndsAt(), $event);
    }

    /**
     * Longer than 24 hours from the earlier of the event's start and its first shift's to the later of their ends.
     *
     * @param list<StaffShift> $shifts
     */
    public static function isLong(Event $event, array $shifts): bool
    {
        $first = $event->getStartsAt()->getTimestamp();
        $last = $event->getEndsAt()->getTimestamp();

        foreach ($shifts as $shift) {
            $first = Math\minva($first, self::instant($shift->getStartsAt(), $event)->getTimestamp());
            $last = Math\maxva($last, self::instant($shift->getEndsAt(), $event)->getTimestamp());
        }

        return $last - $first > self::DAY;
    }

    /** "16:00 to 01:00"; when `long`, "Fri 6 Nov, 16:00 to Sat 7 Nov, 01:00", the end's date left out on the start's date. */
    public function range(DateTimeImmutable $startsAt, DateTimeImmutable $endsAt, bool $long): string
    {
        $sameDay = $startsAt->format('Y-m-d') === $endsAt->format('Y-m-d');

        return $this->translator->trans('staff.shift_range', [
            '{start}' => $long ? $this->moment($startsAt) : $this->clock($startsAt),
            '{end}' => $long && !$sameDay ? $this->moment($endsAt) : $this->clock($endsAt),
        ]);
    }

    private function moment(DateTimeImmutable $wall): string
    {
        return $this->translator->trans('staff.shift_moment', ['{day}' => $this->formatted($wall, 'EEEdMMM'), '{time}' => $this->clock($wall)]);
    }

    /** The 24-hour clock in every locale (sc-30243). */
    private function clock(DateTimeImmutable $wall): string
    {
        return $wall->format('H:i');
    }

    private function formatted(DateTimeImmutable $wall, string $skeleton): string
    {
        $dates = SupportedLocales::dates($this->translator->getLocale());
        $pattern = new IntlDatePatternGenerator($dates)->getBestPattern($skeleton) ?: 'EEE d MMM';
        $formatter = IntlDateFormatter::create($dates, IntlDateFormatter::NONE, IntlDateFormatter::NONE, new DateTimeZone('UTC'), null, $pattern);

        return $formatter?->format($wall) ?: $wall->format('D j M');
    }
}
