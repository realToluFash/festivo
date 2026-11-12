<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\Roles\RoleManager;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Enum\PermissionArea;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Repository\OrganisationRepository;
use Psl\Iter;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** The organisation's three roles, read-only (sc-29912), and the caller's own permissions, so a client renders only what it can use. */
final readonly class RolesController
{
    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private MembershipDirectoryInterface $membershipDirectory,
        private RoleManager $roleManager,
    ) {
    }

    #[Route('/api/orgs/{organisationId}/permissions', name: 'orgs_permissions', methods: ['GET'])]
    #[InOrganisation(null)]
    public function permissions(string $organisationId): JsonResponse
    {
        $grants = $this->membershipDirectory->grantsIn($this->user(), Uuid::fromString($organisationId))
            ?? throw ApiException::notFound('access.not_found');

        return new JsonResponse([
            'permissions' => Vec\map(
                Vec\filter(Permission::cases(), $grants->allows(...)),
                static fn (Permission $permission): string => $permission->value,
            ),
            'withheldUntilTwoFactor' => Vec\map($grants->withheld(), static fn (Permission $permission): string => $permission->value),
            'readOnlyUntilLinked' => $grants->isReadOnly(),
            'withheldUntilLinked' => Vec\map($grants->withheldUntilLinked(), static fn (Permission $permission): string => $permission->value),
        ]);
    }

    /** The three roles, each with what it holds and who holds it, and the registry area by area. */
    #[Route('/api/orgs/{organisationId}/roles', name: 'orgs_roles', methods: ['GET'])]
    #[InOrganisation(Permission::MembersRead)]
    public function list(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);

        return new JsonResponse([
            'roles' => Vec\map($this->roleManager->rolesOf($organisation), $this->role(...)),
            'areas' => Vec\map(PermissionArea::cases(), static fn (PermissionArea $area): array => [
                'area' => $area->value,
                'permissions' => Vec\map(
                    Vec\filter(Permission::cases(), static fn (Permission $permission): bool => $permission->area() === $area),
                    static fn (Permission $permission): string => $permission->value,
                ),
            ]),
        ]);
    }

    /** @return array<string, mixed> */
    private function role(Role $role): array
    {
        $holders = $this->roleManager->holdersOf($role);

        return [
            'id' => $role->getId()->toRfc4122(),
            'seededAs' => $role->getSeededAs()->value,
            'permissions' => Vec\map($role->getPermissions(), static fn (Permission $permission): string => $permission->value),
            'holders' => Iter\count($holders),
            'holderNames' => Vec\map($holders, static fn (Membership $membership): array => [
                'name' => $membership->getUser()->getName(),
                'suspended' => MembershipStatus::Suspended === $membership->getStatus(),
            ]),
        ];
    }

    private function organisation(string $id): Organisation
    {
        return $this->organisationRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
