<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter\Exception;

use LogicException;

/** A settle naming no reservation has no price or hold to charge from: the caller's mistake, and nothing is recorded (sc-3929, 27 Oct). */
final class UnknownReservation extends LogicException
{
}
