<?php

declare(strict_types=1);

namespace App\Enum;

/** Who a milestone falls to, the design's three pills (sc-3624). */
enum MilestoneOwner: string
{
    case Automatic = 'automatic';
    case You = 'you';
    case Event = 'event';
}
