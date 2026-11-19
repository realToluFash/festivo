<?php

declare(strict_types=1);

namespace App\Domain\Billing\Catalogue\Model;

use App\Enum\WhatsAppCategory;
use DateTimeImmutable;
use Psl\Math;
use Symfony\Component\Uid\Uuid;

/** One published version of what each unit costs in credits, for everyone from `effectiveFrom` (sc-3928). A country it does not price is priced from the provider's cost by the formula. */
final readonly class UnitCosts
{
    /**
     * @param array<string, int<0, max>>                $creditPrice                   a credit in the smallest pack, minor units by ISO 4217 code
     * @param int<1, max>                               $providerMicroDollarsPerCredit the formula's divisor: credits = ⌈provider cost ÷ this⌉
     * @param array<string, int<0, max>>                $smsPerSegment                 by ISO 3166-1 alpha-2 country
     * @param array<string, array<string, int<0, max>>> $whatsApp                      by `WhatsAppCategory` value, then country
     */
    public function __construct(
        public Uuid $versionId,
        public string $name,
        public DateTimeImmutable $effectiveFrom,
        public array $creditPrice,
        public int $providerMicroDollarsPerCredit,
        public int $email,
        public string $aiModel,
        public int $aiProposal,
        public int $aiQuestion,
        private array $smsPerSegment,
        private array $whatsApp,
    ) {
    }

    /** @return ?int<0, max> null when this version leaves the country to the formula */
    public function smsPerSegment(string $country): ?int
    {
        return $this->smsPerSegment[$country] ?? null;
    }

    /** @return ?int<0, max> null when this version leaves the country to the formula */
    public function whatsApp(WhatsAppCategory $category, string $country): ?int
    {
        return $this->whatsApp[$category->value][$country] ?? null;
    }

    /** @return int<0, max> */
    public function creditsForProviderCost(int $providerMicroDollars): int
    {
        return Math\maxva(0, Math\div($providerMicroDollars + $this->providerMicroDollarsPerCredit - 1, $this->providerMicroDollarsPerCredit));
    }

    /** Whether any unit costs more here than in `$was`, which takes the notice before it applies. A cell `$was` priced and this leaves to the formula counts as a rise, since the provider's price may be higher. */
    public function risesFrom(self $was): bool
    {
        $pairs = [[$was->email, $this->email], [$was->aiProposal, $this->aiProposal], [$was->aiQuestion, $this->aiQuestion]];

        foreach ($was->smsPerSegment as $country => $credits) {
            $pairs[] = [$credits, $this->smsPerSegment[$country] ?? null];
        }

        foreach ($was->whatsApp as $category => $byCountry) {
            foreach ($byCountry as $country => $credits) {
                $pairs[] = [$credits, $this->whatsApp[$category][$country] ?? null];
            }
        }

        foreach ($pairs as [$before, $after]) {
            if (null === $after || $after > $before) {
                return true;
            }
        }

        return $this->providerMicroDollarsPerCredit < $was->providerMicroDollarsPerCredit;
    }
}
