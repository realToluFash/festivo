<?php

declare(strict_types=1);

namespace App\Domain\Organisation;

use App\Domain\Organisation\SignInRules\SignInRules;
use App\Entity\User;
use App\Http\Access\Grants;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Repository\MembershipRepository;
use Symfony\Component\Uid\Uuid;

final readonly class MembershipDirectory implements MembershipDirectoryInterface
{
    public function __construct(
        private MembershipRepository $membershipRepository,
        private SignInRules $signInRules,
    ) {
    }

    /** The role's permissions, as the organisation last set them (sc-66), narrowed by its sign-in rules (sc-69). */
    public function grantsIn(User $user, Uuid $organisationId): ?Grants
    {
        $membership = $this->membershipRepository->findActive($user, $organisationId);

        if (null === $membership) {
            return null;
        }

        $role = $membership->getRole();

        return $this->signInRules->narrow(
            $role->isOwner() ? Grants::everything() : Grants::only($role->getPermissions()),
            $user,
            $membership->getOrganisation(),
        );
    }
}
