<?php

declare(strict_types=1);

namespace App\Domain\Billing\Catalogue\Model;

use App\Enum\Plan;
use LogicException;
use Symfony\Component\Uid\Uuid;

/** One published version of the plans half of the catalogue: every plan's terms (sc-3928). */
final readonly class PlanCatalogue
{
    /** @param array<string, PlanTerms> $plans by `Plan` value, every one present */
    public function __construct(
        public Uuid $versionId,
        public string $name,
        private array $plans,
    ) {
    }

    public function plan(Plan $plan): PlanTerms
    {
        return $this->plans[$plan->value] ?? throw new LogicException('A catalogue version lacks the ' . $plan->value . ' plan.');
    }
}
