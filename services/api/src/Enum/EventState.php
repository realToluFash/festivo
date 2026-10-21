<?php

declare(strict_types=1);

namespace App\Enum;

/** An event's stored state (sc-3584); its phase on the clock is worked out, not stored (sc-3585). */
enum EventState: string
{
    case Draft = 'draft';
    case Live = 'live';
    case Paused = 'paused';
    case Ended = 'ended';

    public function allows(EventAction $action): bool
    {
        return match ($this) {
            self::Draft => match ($action) {
                EventAction::Edit, EventAction::Delete, EventAction::MakeLive => true,
                default => false,
            },
            self::Live => EventAction::MakeLive !== $action,
            self::Paused, self::Ended => false,
        };
    }
}
