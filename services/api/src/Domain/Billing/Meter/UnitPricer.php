<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter;

use App\Domain\Billing\Catalogue\Catalogue;
use App\Domain\Billing\Catalogue\Model\UnitCosts;
use App\Domain\Billing\Meter\Exception\Unpriced;
use App\Domain\Billing\Meter\Model\MeteredUse;
use App\Enum\UsageKind;
use App\Enum\WhatsAppCategory;

/** Credits per unit of a use in a unit-cost version (sc-3928): the version's own figure, or the formula on the provider's cost when the version leaves the country to it. */
final readonly class UnitPricer
{
    public function __construct(
        private Catalogue $catalogue,
    ) {
    }

    public function in(UnitCosts $version, MeteredUse $use): int
    {
        return self::listed($version, $use) ?? self::byFormula($version, $use);
    }

    /**
     * A message settling as a kind it was not reserved as: the reservation's version prices it, or the first later one that does (sc-3929, 26 Oct).
     *
     * @return array{UnitCosts, int} the version that priced it, and the price
     */
    public function fromVersion(UnitCosts $version, MeteredUse $use): array
    {
        foreach ($this->catalogue->unitCostsFrom($version->versionId) as $candidate) {
            $listed = self::listed($candidate, $use);

            if (null !== $listed) {
                return [$candidate, $listed];
            }
        }

        return [$version, self::byFormula($version, $use)];
    }

    private static function listed(UnitCosts $version, MeteredUse $use): ?int
    {
        return match ($use->kind) {
            UsageKind::Email => $version->email,
            UsageKind::Sms => $version->smsPerSegment((string) $use->country),
            UsageKind::WhatsApp => $version->whatsApp($use->whatsAppCategory ?? WhatsAppCategory::Utility, (string) $use->country),
            UsageKind::AiRequest => $version->aiProposal,
            UsageKind::StorageBytes => 0,
        };
    }

    private static function byFormula(UnitCosts $version, MeteredUse $use): int
    {
        if (null === $use->providerMicroDollars) {
            throw new Unpriced('Unit costs ' . $version->name . ' do not price ' . $use->kind->value . ' to ' . (string) $use->country . ', and no provider cost came with it.');
        }

        return $version->creditsForProviderCost($use->providerMicroDollars);
    }
}
