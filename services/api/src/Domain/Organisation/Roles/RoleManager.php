<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Roles;

use App\Audit\Auditor;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Http\Exception\ApiException;
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
    ) {
    }

    /** @return list<Role> the seeded ones in their order, then the organisation's own by name */
    public function rolesOf(Organisation $organisation): array
    {
        $roles = $this->entityManager->getRepository(Role::class)->findBy(['organisation' => $organisation]);
        $order = Dict\flip(Vec\map(SeededRole::cases(), static fn (SeededRole $seeded): string => $seeded->value));
        $rank = static fn (Role $role): int => $order[$role->getSeededAs()->value ?? ''] ?? Iter\count($order);

        return Vec\sort($roles, static fn (Role $a, Role $b): int => [$rank($a), Str\lowercase($a->label())] <=> [$rank($b), Str\lowercase($b->label())]);
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
        $role = Role::custom($organisation, $this->name($organisation, $name, null), $this->permissions($permissions));
        $this->entityManager->persist($role);
        $this->record($by, $role, 'role.created', ['name' => [null, $role->label()]]);
        $this->entityManager->flush();

        return $role;
    }

    /** @param list<string>|null $permissions */
    public function update(Role $role, User $by, ?string $name, ?array $permissions): Role
    {
        if ($role->isOwner()) {
            throw new ApiException(ErrorCode::OwnerRoleFixed, $this->translator->trans('roles.owner_fixed'));
        }

        if (null !== $name && Str\trim($name) !== $role->label()) {
            if (null !== $role->getSeededAs()) {
                throw $this->invalid('name', 'roles.name_builtin');
            }

            $before = $role->label();
            $role->rename($this->name($role->getOrganisation(), $name, $role));
            $this->record($by, $role, 'role.renamed', ['name' => [$before, $role->label()]]);
        }

        if (null !== $permissions) {
            $before = Vec\map($role->getPermissions(), static fn (Permission $permission): string => $permission->value);
            $role->setPermissions($this->permissions($permissions));
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

        if ([] !== $holders) {
            if (null === $replacementId || '' === $replacementId) {
                throw $this->invalid('replacement', 'roles.replacement_required');
            }

            $replacement = $this->replacement($role, $replacementId);

            foreach ($holders as $membership) {
                $this->roleAssignment->assign($membership, $replacement);
            }
        }

        $this->record($by, $role, 'role.deleted', ['name' => [$role->label(), null]]);
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

    /** Trimmed, required, at most 40, and unique in the organisation ignoring case, the seeded labels included. */
    private function name(Organisation $organisation, string $typed, ?Role $self): string
    {
        $name = Str\trim($typed);

        if ('' === $name) {
            throw $this->invalid('name', 'roles.name_required');
        }

        if (Str\length($name) > self::NAME_MAXIMUM) {
            throw $this->invalid('name', 'roles.name_too_long', ['{count}' => (string) self::NAME_MAXIMUM]);
        }

        $taken = Iter\any(
            $this->rolesOf($organisation),
            static fn (Role $role): bool => $role !== $self && Str\lowercase($role->label()) === Str\lowercase($name),
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
