<?php

declare(strict_types=1);

namespace App\Domain\Organisation;

use App\Entity\User;
use App\Http\Access\Grants;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Repository\MembershipRepository;
use Symfony\Component\Uid\Uuid;

final readonly class MembershipDirectory implements MembershipDirectoryInterface
{
    public function __construct(
        private MembershipRepository $membershipRepository,
    ) {
    }

    /** The role's permissions, as the organisation last set them; Owner holds everything (sc-66). */
    public function grantsIn(User $user, Uuid $organisationId): ?Grants
    {
        $role = $this->membershipRepository->findActive($user, $organisationId)?->getRole();

        if (null === $role) {
            return null;
        }

        return $role->isOwner() ? Grants::everything() : Grants::only($role->getPermissions());
    }
}
