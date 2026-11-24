<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter\Model;

use DateTimeImmutable;
use DateTimeZone;
use Psl\Math;

/** One month of a subscription, counted from its period start: the same day and time each month, or the month's last day when it is shorter (sc-3929, 24 Nov). */
final readonly class SubscriptionPeriod
{
    private function __construct(
        public DateTimeImmutable $start,
        public DateTimeImmutable $end,
    ) {
    }

    /** The period `$at` falls in; a moment before the period start falls in the first. */
    public static function containing(DateTimeImmutable $periodStart, DateTimeImmutable $at): self
    {
        $anchor = $periodStart->setTimezone(new DateTimeZone('UTC'));
        $moment = $at->setTimezone(new DateTimeZone('UTC'));
        $months = Math\maxva(0, (((int) $moment->format('Y') - (int) $anchor->format('Y')) * 12) + (int) $moment->format('n') - (int) $anchor->format('n'));

        if ($months > 0 && self::monthsOn($anchor, $months) > $moment) {
            --$months;
        }

        return new self(self::monthsOn($anchor, $months), self::monthsOn($anchor, $months + 1));
    }

    public function contains(DateTimeImmutable $at): bool
    {
        return $this->start <= $at && $at < $this->end;
    }

    private static function monthsOn(DateTimeImmutable $anchor, int $months): DateTimeImmutable
    {
        $first = $anchor->setDate((int) $anchor->format('Y'), (int) $anchor->format('n'), 1)->modify('+' . $months . ' months');

        return $first->setDate((int) $first->format('Y'), (int) $first->format('n'), Math\minva((int) $anchor->format('j'), (int) $first->format('t')));
    }
}
