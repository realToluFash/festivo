<?php

declare(strict_types=1);

namespace App\Enum;

/** The steps that move a plate (sc-4005). Mirrors packages/domain's PLATE_STEPS. */
enum PlateStep: string
{
    case Start = 'start';
    case Check = 'check';
    case TakeOff = 'takeOff';
    case TakeToTable = 'takeToTable';
    case Serve = 'serve';
    case SendBack = 'sendBack';
}
