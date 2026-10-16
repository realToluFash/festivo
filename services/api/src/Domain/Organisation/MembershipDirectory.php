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

    /** Until sc-66 gives roles their permissions, only Owner exists, and it holds everything. */
    public function grantsIn(User $user, Uuid $organisationId): ?Grants
    {
        $membership = $this->membershipRepository->findActive($user, $organisationId);

        if (null === $membership) {
            return null;
        }

        return $membership->getRole()->isOwner() ? Grants::everything() : Grants::only([]);
    }
}
