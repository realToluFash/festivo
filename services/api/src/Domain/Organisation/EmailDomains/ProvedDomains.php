<?php

declare(strict_types=1);

namespace App\Domain\Organisation\EmailDomains;

use App\Domain\Billing\Entitlements;
use App\Domain\Organisation\Interfaces\EnterpriseSettingInterface;
use App\Entity\Organisation;
use App\Enum\PlanFeature;
use App\Repository\EmailDomainRepository;

/** Who has proved a domain, while that proof is in force: on Enterprise, as sc-581 rules every setting. */
final readonly class ProvedDomains implements EnterpriseSettingInterface
{
    public function __construct(
        private EmailDomainRepository $emailDomainRepository,
        private Entitlements $entitlements,
    ) {
    }

    public function feature(): PlanFeature
    {
        return PlanFeature::EmailDomains;
    }

    public function isConfigured(Organisation $organisation): bool
    {
        return $this->emailDomainRepository->hasProvedIn($organisation);
    }

    public function provedBy(string $domain): ?Organisation
    {
        $proof = $this->emailDomainRepository->findProvedOf($domain);

        // A proof is configured by being one, so in force is the plan's half of EnterpriseSettings::inForce() alone.
        return null !== $proof && $this->entitlements->of($proof->getOrganisation()->getId())->unlocks(PlanFeature::EmailDomains) ? $proof->getOrganisation() : null;
    }

    public function isProvedElsewhere(string $domain, Organisation $organisation): bool
    {
        $by = $this->provedBy($domain);

        return null !== $by && !$by->getId()->equals($organisation->getId());
    }

    public function isProvedBy(string $domain, Organisation $organisation): bool
    {
        return true === $this->provedBy($domain)?->getId()->equals($organisation->getId());
    }
}
