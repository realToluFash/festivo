<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Model;

use App\Entity\SchedulePress;
use App\Enum\ErrorCode;

/** Why a press changed nothing, and the earlier press it lost to, when there is one. */
final readonly class PressLoss
{
    public function __construct(
        public ErrorCode $code,
        public ?SchedulePress $to,
    ) {
    }
}
