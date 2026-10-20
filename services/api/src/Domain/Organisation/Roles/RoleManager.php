<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Roles;

use App\Audit\Auditor;
use App\Domain\Organisation\Members\OwnerCheck;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Exception\ApiException;
use App\Locale\SupportedLocales;
use App\Repository\InvitationRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** An organisation's roles (sc-66): the five seeded ones edited, never deleted; Owner fixed; custom ones free. */
final readonly class RoleManager
{
    public const int NAME_MAXIMUM = 40;

    public function __construct(
        private EntityManagerInterface $entityManager,
        private RoleAssignment $roleAssignment,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private MembershipDirectoryInterface $membershipDirectory,
        private SeededRoleLabels $seededRoleLabels,
        private InvitationRepository $invitationRepository,
        private OwnerCheck $ownerCheck,
    ) {
    }

    /** @return list<Role> the seeded ones in their order, then the organisation's own by name */
    public function rolesOf(Organisation $organisation): array
    {
        $roles = $this->entityManager->getRepository(Role::class)->findBy(['organisation' => $organisation]);
        $order = Dict\flip(Vec\map(SeededRole::cases(), static fn (SeededRole $seeded): string => $seeded->value));
        $rank = static fn (Role $role): int => $order[$role->getSeededAs()->value ?? ''] ?? Iter\count($order);

        return Vec\sort($roles, static fn (Role $a, Role $b): int => [$rank($a), Str\lowercase($a->getName() ?? '')] <=> [$rank($b), Str\lowercase($b->getName() ?? '')]);
    }

    /** Scoped to the organisation before it is used: another organisation's role id is not found. */
    public function find(Organisation $organisation, string $id): Role
    {
        $role = Uuid::isValid($id) ? $this->entityManager->getRepository(Role::class)->find(Uuid::fromString($id)) : null;

        if (null === $role || !$role->getOrganisation()->getId()->equals($organisation->getId())) {
            throw ApiException::notFound('That role is not in this organisation.');
        }

        return $role;
    }

    public function holders(Role $role): int
    {
        return $this->entityManager->getRepository(Membership::class)->count(['role' => $role]);
    }

    /** @param list<string> $permissions */
    public function create(Organisation $organisation, User $by, string $name, array $permissions): Role
    {
        $granted = $this->permissions($permissions);
        $this->withinHeld($organisation, $by, $granted);
        $role = Role::custom($organisation, $this->name($organisation, $name, null), $granted);
        $this->entityManager->persist($role);
        $this->record($by, $role, 'role.created', ['name' => [null, $role->getName()]]);
        $this->entityManager->flush();

        return $role;
    }

    /** @param list<string>|null $permissions */
    public function update(Role $role, User $by, ?string $name, ?array $permissions): Role
    {
        if ($role->isOwner()) {
            throw new ApiException(ErrorCode::OwnerRoleFixed, $this->translator->trans('roles.owner_fixed'));
        }

        if (null !== $name && RoleName::of($name) !== RoleName::of($this->currentName($role) ?? '')) {
            if (null !== $role->getSeededAs()) {
                throw $this->invalid('name', 'roles.name_builtin');
            }

            $before = $role->getName();
            $role->rename($this->name($role->getOrganisation(), $name, $role));
            $this->record($by, $role, 'role.renamed', ['name' => [$before, $role->getName()]]);
        }

        if (null !== $permissions) {
            $wanted = $this->permissions($permissions);
            $changed = Vec\filter(Permission::cases(), static fn (Permission $permission): bool => Iter\contains($role->getPermissions(), $permission) !== Iter\contains($wanted, $permission));
            $this->withinHeld($role->getOrganisation(), $by, $changed);
            $before = Vec\map($role->getPermissions(), static fn (Permission $permission): string => $permission->value);
            $role->setPermissions($wanted);
            $after = Vec\map($role->getPermissions(), static fn (Permission $permission): string => $permission->value);
            $this->record($by, $role, 'role.permissions_changed', ['permissions' => [$before, $after]]);
        }

        $this->entityManager->flush();

        return $role;
    }

    /** Deleting one that members hold needs the role they move to: nobody is left with none. */
    public function delete(Role $role, User $by, ?string $replacementId): void
    {
        if ($role->isOwner()) {
            throw new ApiException(ErrorCode::OwnerRoleFixed, $this->translator->trans('roles.owner_fixed'));
        }

        if (null !== $role->getSeededAs()) {
            throw new ApiException(ErrorCode::SeededRoleKept, $this->translator->trans('roles.seeded_kept'));
        }

        $holders = $this->entityManager->getRepository(Membership::class)->findBy(['role' => $role]);
        // An invitation still pending would otherwise lose its role and could never be accepted.
        $invited = $this->invitationRepository->findPendingWithRole($role);

        if ([] !== $holders || [] !== $invited) {
            if (null === $replacementId || '' === $replacementId) {
                throw $this->invalid('replacement', 'roles.replacement_required');
            }

            $replacement = $this->replacement($role, $replacementId);
            $this->mayGrant($role->getOrganisation(), $by, $replacement);

            foreach ($holders as $membership) {
                $this->roleAssignment->assign($membership, $replacement);
            }

            foreach ($invited as $invitation) {
                $invitation->setRole($replacement);
            }
        }

        $this->record($by, $role, 'role.deleted', ['name' => [$role->getName(), null]]);
        $this->entityManager->remove($role);
        $this->entityManager->flush();
    }

    private function replacement(Role $role, string $id): Role
    {
        try {
            $replacement = $this->find($role->getOrganisation(), $id);
        } catch (ApiException) {
            throw $this->invalid('replacement', 'roles.replacement_invalid');
        }

        if ($replacement->getId()->equals($role->getId())) {
            throw $this->invalid('replacement', 'roles.replacement_invalid');
        }

        return $replacement;
    }

    /** A seeded role sent back under its English label, as sc-66 shipped it, is not being renamed. */
    private function currentName(Role $role): ?string
    {
        $seeded = $role->getSeededAs();

        return null === $seeded ? $role->getName() : $this->seededRoleLabels->label($seeded, SupportedLocales::DEFAULT);
    }

    /** Trimmed and in NFC, required, at most 40, and unique ignoring case among the organisation's own roles and the seeded labels in every language. */
    private function name(Organisation $organisation, string $typed, ?Role $self): string
    {
        $name = RoleName::of($typed);

        if ('' === $name) {
            throw $this->invalid('name', 'roles.name_required');
        }

        if (Str\length($name) > self::NAME_MAXIMUM) {
            throw $this->invalid('name', 'roles.name_too_long', ['{count}' => (string) self::NAME_MAXIMUM]);
        }

        $taken = $this->seededRoleLabels->includes($name) || Iter\any(
            $this->rolesOf($organisation),
            static fn (Role $role): bool => $role !== $self && RoleName::same($role->getName() ?? '', $name),
        );

        if ($taken) {
            throw $this->invalid('name', 'roles.name_taken', [], 'role_name_taken');
        }

        return $name;
    }

    /**
     * @param list<string> $values
     *
     * @return list<Permission>
     */
    private function permissions(array $values): array
    {
        $permissions = Vec\map($values, Permission::tryFrom(...));

        if (Iter\contains($permissions, null)) {
            throw $this->invalid('permissions', 'roles.permission_unknown');
        }

        return Type\vec(Type\instance_of(Permission::class))->coerce($permissions);
    }

    /** Whoever puts somebody in a role, by invitation, by moving them or by deleting theirs, is held to this one rule. */
    public function mayGrant(Organisation $organisation, User $by, Role $role): void
    {
        $this->withinHeld($organisation, $by, $role->getPermissions());

        if ($role->isOwner() && !$this->ownerCheck->holds($organisation, $by)) {
            throw new ApiException(ErrorCode::GrantNotHeld, $this->translator->trans('roles.grant_not_held'));
        }
    }

    /** @param list<Permission> $permissions nobody grants or withdraws what they lack (least privilege), so only Owner names Owner */
    private function withinHeld(Organisation $organisation, User $by, array $permissions): void
    {
        $grants = $this->membershipDirectory->grantsIn($by, $organisation->getId());

        if (Iter\any($permissions, static fn (Permission $permission): bool => null === $grants || !$grants->holds($permission))) {
            throw new ApiException(ErrorCode::GrantNotHeld, $this->translator->trans('roles.grant_not_held'));
        }
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function record(User $by, Role $role, string $action, array $changes): void
    {
        $this->auditor->record($action, 'Role', $role->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
    }

    /** @param array<string, string> $parameters */
    private function invalid(string $field, string $key, array $parameters = [], ?string $code = null): ApiException
    {
        return ApiException::validation([[
            'propertyPath' => $field,
            'message' => $this->translator->trans($key, $parameters),
            'code' => $code ?? ErrorCode::ValidationFailed->value,
        ]]);
    }
}
