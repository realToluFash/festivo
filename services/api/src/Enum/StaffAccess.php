<?php

declare(strict_types=1);

namespace App\Enum;

/** What a job's people may do on its event through their accounts (sc-71, sc-4002), always below editing the event. */
enum StaffAccess: string
{
    case View = 'view';
    case CheckIn = 'check_in';
    case Floor = 'floor';
    case Pass = 'pass';
    case Run = 'run';

    /** The level a staff link's sign-in holds on the event (sc-4235): the job's own level (sc-4002), never Can edit or above. */
    public function eventRole(): EventRole
    {
        return match ($this) {
            self::View => EventRole::CanView,
            self::CheckIn => EventRole::CanCheckIn,
            self::Floor => EventRole::CanWorkFloor,
            self::Pass => EventRole::CanWorkPass,
            self::Run => EventRole::CanRunFloor,
        };
    }
}
