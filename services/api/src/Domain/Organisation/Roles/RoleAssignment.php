<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Roles;

use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Enum\ErrorCode;
use App\Enum\MembershipStatus;
use App\Http\Exception\ApiException;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Type;
use Symfony\Contracts\Translation\TranslatorInterface;

/** A member holds exactly one role per organisation, and an organisation always has an owner (sc-66). */
final readonly class RoleAssignment
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
    ) {
    }

    public function assign(Membership $membership, Role $role): void
    {
        $leavesOwner = $membership->getRole()->isOwner() && !$role->isOwner();

        if ($leavesOwner && $membership->isActive() && 1 === $this->activeOwners($membership->getOrganisation())) {
            throw new ApiException(ErrorCode::LastOwner, $this->translator->trans('roles.last_owner'));
        }

        $membership->changeRole($role);
    }

    private function activeOwners(Organisation $organisation): int
    {
        return Type\int()->coerce($this->entityManager->createQuery(
            'SELECT COUNT(m.id) FROM ' . Membership::class . ' m JOIN m.role r WHERE m.organisation = :organisation AND m.status = :active AND r.seededAs = :owner',
        )
            ->setParameter('organisation', $organisation)
            ->setParameter('active', MembershipStatus::Active)
            ->setParameter('owner', 'owner')
            ->getSingleScalarResult());
    }
}
