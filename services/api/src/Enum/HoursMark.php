<?php

declare(strict_types=1);

namespace App\Enum;

/** What is missing from a shift's hours worked, shown rather than guessed (sc-234). */
enum HoursMark: string
{
    case NotClockedOut = 'not_clocked_out';
    case NoAttendance = 'no_attendance';
}
