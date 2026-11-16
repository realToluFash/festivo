<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Roles;

use App\Domain\Organisation\Members\OwnerCheck;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Exception\ApiException;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** An organisation's three roles (sc-29912), which nobody edits, and who may put somebody in one. */
final readonly class RoleManager
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
        private MembershipDirectoryInterface $membershipDirectory,
        private OwnerCheck $ownerCheck,
    ) {
    }

    /** @return list<Role> Owner, Admin, Member */
    public function rolesOf(Organisation $organisation): array
    {
        $roles = $this->entityManager->getRepository(Role::class)->findBy(['organisation' => $organisation]);
        $order = Dict\flip(Vec\map(SeededRole::cases(), static fn (SeededRole $seeded): string => $seeded->value));

        return Vec\sort($roles, static fn (Role $a, Role $b): int => $order[$a->getSeededAs()->value] <=> $order[$b->getSeededAs()->value]);
    }

    /** Scoped to the organisation before it is used: another organisation's role id is not found. */
    public function find(Organisation $organisation, string $id): Role
    {
        $role = Uuid::isValid($id) ? $this->entityManager->getRepository(Role::class)->find(Uuid::fromString($id)) : null;

        if (null === $role || !$role->getOrganisation()->getId()->equals($organisation->getId())) {
            throw ApiException::notFound('roles.not_in_organisation');
        }

        return $role;
    }

    public function holders(Role $role): int
    {
        return $this->entityManager->getRepository(Membership::class)->count([
            'role' => $role,
            'status' => MembershipStatus::holding(),
        ]);
    }

    /** Whoever puts somebody in a role, by invitation, approval or a change, is held to this one rule: an Admin makes Admins and Members, and only an Owner makes an Owner. */
    public function mayGrant(Organisation $organisation, User $by, Role $role): void
    {
        $grants = $this->membershipDirectory->grantsIn($by, $organisation->getId());

        if (Iter\any($role->getPermissions(), static fn (Permission $permission): bool => null === $grants || !$grants->holds($permission))) {
            throw new ApiException(ErrorCode::GrantNotHeld, $this->translator->trans('roles.grant_not_held'));
        }

        if ($role->isOwner() && !$this->ownerCheck->holds($organisation, $by)) {
            throw new ApiException(ErrorCode::GrantNotHeld, $this->translator->trans('roles.grant_not_held'));
        }
    }
}
