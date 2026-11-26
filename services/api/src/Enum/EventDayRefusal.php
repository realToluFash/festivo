<?php

declare(strict_types=1);

namespace App\Enum;

/** Why a day typed as "before the event" is refused; each caller's translation key ends in the value. */
enum EventDayRefusal: string
{
    case Invalid = 'invalid';
    case Past = 'past';
    case NotBeforeEvent = 'not_before_event';
}
