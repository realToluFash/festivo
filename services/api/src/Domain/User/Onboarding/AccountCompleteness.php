<?php

declare(strict_types=1);

namespace App\Domain\User\Onboarding;

use App\Entity\User;
use App\Enum\AccountOrigin;
use App\Repository\MembershipRepository;
use Psl\Str;

/** A name and the details screen saved once; losing every organisation later leaves the account complete (sc-68). */
final readonly class AccountCompleteness
{
    public function __construct(
        private MembershipRepository $membershipRepository,
    ) {
    }

    public function isComplete(User $user): bool
    {
        return '' !== Str\trim($user->getName()) && $user->hasSavedDetails();
    }

    /** The details screen asks for one: a self-registered account in none that has not saved it yet. An invited one joins the inviting one. */
    public function needsOrganisation(User $user): bool
    {
        return AccountOrigin::SelfRegistered === $user->getOrigin()
            && !$user->hasSavedDetails()
            && !$this->hasOrganisation($user);
    }

    public function hasOrganisation(User $user): bool
    {
        return [] !== $this->membershipRepository->findActiveFor($user);
    }
}
