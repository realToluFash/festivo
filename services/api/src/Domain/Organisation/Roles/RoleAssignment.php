<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Roles;

use App\Entity\Membership;
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
        if (!$role->isOwner()) {
            $this->release($membership);
        }

        $membership->changeRole($role);
    }

    /** Refused for the last owner: demoting, removing and leaving all pass through here. */
    public function release(Membership $membership): void
    {
        if ($this->isLastOwner($membership)) {
            throw new ApiException(ErrorCode::LastOwner, $this->translator->trans('roles.last_owner'));
        }
    }

    /** An owner, active or suspended (sc-564), with no other active owner beside them. */
    public function isLastOwner(Membership $membership): bool
    {
        return $membership->getRole()->isOwner()
            && ($membership->isActive() || MembershipStatus::Suspended === $membership->getStatus())
            && 0 === $this->otherActiveOwners($membership);
    }

    private function otherActiveOwners(Membership $membership): int
    {
        return Type\int()->coerce($this->entityManager->createQuery(
            'SELECT COUNT(m.id) FROM ' . Membership::class . ' m JOIN m.role r WHERE m.organisation = :organisation AND m <> :membership AND m.status = :active AND r.seededAs = :owner',
        )
            ->setParameter('organisation', $membership->getOrganisation())
            ->setParameter('membership', $membership)
            ->setParameter('active', MembershipStatus::Active)
            ->setParameter('owner', 'owner')
            ->getSingleScalarResult());
    }
}
