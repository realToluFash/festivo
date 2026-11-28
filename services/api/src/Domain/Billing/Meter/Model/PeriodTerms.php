<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter\Model;

use App\Domain\Billing\Catalogue\Model\PlanTerms;

/** A period of a subscription and the plan terms its included amounts come from: those in force when it ended, or today's while it runs (sc-3929, 24 Nov). */
final readonly class PeriodTerms
{
    public function __construct(
        public SubscriptionPeriod $period,
        public PlanTerms $terms,
    ) {
    }
}
