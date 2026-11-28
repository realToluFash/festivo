<?php

declare(strict_types=1);

namespace App\Domain\Billing\Catalogue\Model;

use App\Enum\CatalogueLimit;
use App\Enum\Plan;
use App\Enum\PlanFeature;
use App\Enum\PlanSales;
use LogicException;
use Psl\Iter;

/** What one plan allows, includes, costs and switches on, as one catalogue version holds it (sc-3928). */
final readonly class PlanTerms
{
    /**
     * @param array<string, LimitTerms> $limits   by `CatalogueLimit` value, every one present
     * @param array<string, Price>      $prices   by ISO 4217 code
     * @param list<PlanFeature>         $features
     */
    public function __construct(
        public Plan $plan,
        public PlanSales $sales,
        private array $limits,
        private array $prices,
        private array $features,
    ) {
    }

    public function limit(CatalogueLimit $limit): LimitTerms
    {
        return $this->limits[$limit->value] ?? throw new LogicException('A catalogue plan lacks ' . $limit->value . '.');
    }

    public function price(string $currency): ?Price
    {
        return $this->prices[$currency] ?? null;
    }

    /** @return array<string, Price> by ISO 4217 code */
    public function prices(): array
    {
        return $this->prices;
    }

    public function unlocks(PlanFeature $feature): bool
    {
        return Iter\contains($this->features, $feature);
    }

    /** @return list<PlanFeature> */
    public function features(): array
    {
        return $this->features;
    }
}
