<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter\Exception;

use DomainException;

/** A read for a moment before the subscription's first period start: there is no period then (sc-3929, 24 Nov). */
final class BeforeTheFirstPeriod extends DomainException
{
}
