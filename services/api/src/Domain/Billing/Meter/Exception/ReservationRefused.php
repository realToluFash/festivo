<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter\Exception;

use App\Enum\UsageKind;
use RuntimeException;

/** The included amount and the credits together do not cover what was asked to be reserved. */
final class ReservationRefused extends RuntimeException
{
    /** @param int $creditsFree may be below 0 after a late settle */
    public function __construct(
        public readonly UsageKind $kind,
        public readonly int $creditsNeeded,
        public readonly int $creditsFree,
    ) {
        parent::__construct('Reserving ' . $kind->value . ' needs ' . $creditsNeeded . ' credits and ' . $creditsFree . ' are free.');
    }
}
