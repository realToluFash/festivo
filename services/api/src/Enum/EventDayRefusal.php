<?php

declare(strict_types=1);

namespace App\Enum;

/** Why a day typed as "before the event" is refused; each caller words its own refusal. */
enum EventDayRefusal
{
    case Invalid;
    case Past;
    case NotBeforeEvent;
}
