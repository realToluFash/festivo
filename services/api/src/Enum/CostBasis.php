<?php

declare(strict_types=1);

namespace App\Enum;

/** What a budget line's rate is multiplied by (sc-83); QuantityResolver answers how many of each an event has. */
enum CostBasis: string
{
    case PerHead = 'per_head';
    case PerTable = 'per_table';
    case PerStaffHour = 'per_staff_hour';
    case PerDay = 'per_day';
    case Fixed = 'fixed';

    /** A fixed line's price is its amount; a staff-time line has none, its cost being Staff rates' (sc-101). */
    public function isPriced(): bool
    {
        return self::PerStaffHour !== $this;
    }
}
