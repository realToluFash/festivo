<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter\Exception;

use LogicException;

/** No unit-cost version prices the use, and no provider cost came with it for the formula (sc-3928). */
final class Unpriced extends LogicException
{
}
