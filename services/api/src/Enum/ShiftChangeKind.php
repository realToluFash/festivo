<?php

declare(strict_types=1);

namespace App\Enum;

/** One line of a change notice to a person on the staff (sc-4333), in the order the message gives them. */
enum ShiftChangeKind: string
{
    case Date = 'date';
    case StartTime = 'start_time';
    case EndTime = 'end_time';
    case ShiftAdded = 'shift_added';
    case ShiftRemoved = 'shift_removed';
    case ShiftRetimed = 'shift_retimed';
    case MoreChanges = 'more_changes';
    case NoShiftLeft = 'no_shift_left';
    case Job = 'job';
    case Venue = 'venue';

    public function isShiftLine(): bool
    {
        return self::ShiftAdded === $this || self::ShiftRemoved === $this || self::ShiftRetimed === $this;
    }
}
