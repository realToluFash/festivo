<?php

declare(strict_types=1);

namespace App\Domain\User\Onboarding;

use App\Entity\User;
use App\Enum\AccountOrigin;
use App\Repository\MembershipRepository;
use Psl\Str;

/** A name, the details screen saved once, and for an account that founded its own, an organisation. */
final readonly class AccountCompleteness
{
    public function __construct(
        private MembershipRepository $membershipRepository,
    ) {
    }

    public function isComplete(User $user): bool
    {
        if ('' === Str\trim($user->getName()) || !$user->hasSavedDetails()) {
            return false;
        }

        return !$this->needsOrganisation($user);
    }

    /** The details screen asks for one: a self-registered account in none. An invited one joins the inviting one. */
    public function needsOrganisation(User $user): bool
    {
        return AccountOrigin::SelfRegistered === $user->getOrigin() && !$this->hasOrganisation($user);
    }

    public function hasOrganisation(User $user): bool
    {
        return [] !== $this->membershipRepository->findActiveFor($user);
    }
}
