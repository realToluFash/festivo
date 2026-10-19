<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SignInRules;

use App\Domain\Organisation\SignInRules\Model\InactivityLimit;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\User;
use App\Http\Access\Grants;
use App\Repository\MembershipRepository;
use App\Repository\ProviderIdentityRepository;
use App\Repository\TwoFactorFactorRepository;
use Psl\Iter;
use Psl\Vec;

/** How an organisation's sign-in rules (sc-69) apply to one member. An organisation with none set changes nothing. */
final readonly class SignInRules
{
    /** The lengths the owner chooses between; null is no limit. */
    public const array INACTIVITY_DAYS = [7, 30];

    public function __construct(
        private MembershipRepository $membershipRepository,
        private ProviderIdentityRepository $providerIdentityRepository,
        private TwoFactorFactorRepository $twoFactorFactorRepository,
    ) {
    }

    /** The organisation that turns this account's password away: Google or Apple only, and the account has one linked. */
    public function refusingPassword(User $user): ?Organisation
    {
        if (!$this->isLinked($user)) {
            return null;
        }

        return $this->requiringProvider($user);
    }

    /** The first organisation the account belongs to that signs in with Google or Apple only. */
    public function requiringProvider(User $user): ?Organisation
    {
        return Iter\first(Vec\filter(
            $this->organisationsOf($user),
            static fn (Organisation $organisation): bool => $organisation->isProviderSignInOnly(),
        ));
    }

    /** Read-only until a provider is linked; administration withheld until two-factor is on. Nothing else changes. */
    public function narrow(Grants $grants, User $user, Organisation $organisation): Grants
    {
        if ($organisation->isProviderSignInOnly() && !$this->isLinked($user)) {
            $grants = $grants->readingOnly();
        }

        if ($organisation->isAdministratorsNeedTwoFactor() && !$this->hasTwoFactor($user)) {
            $grants = $grants->withholdingAdministration();
        }

        return $grants;
    }

    /** The shortest limit across every organisation the account belongs to; the earliest joined wins a tie. */
    public function inactivityLimit(User $user): ?InactivityLimit
    {
        $limit = null;

        foreach ($this->organisationsOf($user) as $organisation) {
            $days = $organisation->getInactivityTimeoutDays();

            if (null !== $days && (null === $limit || $days < $limit->days)) {
                $limit = new InactivityLimit($organisation, $days);
            }
        }

        return $limit;
    }

    public function isLinked(User $user): bool
    {
        return $this->providerIdentityRepository->count(['user' => $user]) > 0;
    }

    public function hasTwoFactor(User $user): bool
    {
        return null !== $this->twoFactorFactorRepository->findActiveFor($user);
    }

    /** @return list<Organisation> */
    private function organisationsOf(User $user): array
    {
        return Vec\map($this->membershipRepository->findActiveFor($user), static fn (Membership $membership): Organisation => $membership->getOrganisation());
    }
}
