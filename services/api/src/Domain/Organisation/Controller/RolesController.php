<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\Roles\RoleManager;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\PermissionArea;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\OrganisationRepository;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** Settings > Roles (sc-66), and the caller's own permissions, so a client renders only what it can use. */
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
            ?? throw ApiException::notFound('Not found.');

        return new JsonResponse([
            'permissions' => Vec\map(
                Vec\filter(Permission::cases(), $grants->holds(...)),
                static fn (Permission $permission): string => $permission->value,
            ),
        ]);
    }

    /** Every role with what it holds and how many hold it, and the registry the grid draws, area by area. */
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

    #[Route('/api/orgs/{organisationId}/roles', name: 'orgs_roles_create', methods: ['POST'])]
    #[InOrganisation(Permission::MembersManage)]
    public function create(Request $request, string $organisationId): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'name' => Type\string(),
            'permissions' => Type\optional(Type\vec(Type\string())),
        ]));
        $role = $this->roleManager->create($this->organisation($organisationId), $this->user(), $body['name'], $body['permissions'] ?? []);

        return new JsonResponse($this->role($role), Response::HTTP_CREATED);
    }

    #[Route('/api/orgs/{organisationId}/roles/{roleId}', name: 'orgs_roles_update', methods: ['PATCH'])]
    #[InOrganisation(Permission::MembersManage)]
    public function update(Request $request, string $organisationId, string $roleId): JsonResponse
    {
        $body = Input::body($request, Type\shape([
            'name' => Type\optional(Type\string()),
            'permissions' => Type\optional(Type\vec(Type\string())),
        ]));
        $role = $this->roleManager->find($this->organisation($organisationId), $roleId);

        return new JsonResponse($this->role($this->roleManager->update($role, $this->user(), $body['name'] ?? null, $body['permissions'] ?? null)));
    }

    #[Route('/api/orgs/{organisationId}/roles/{roleId}', name: 'orgs_roles_delete', methods: ['DELETE'])]
    #[InOrganisation(Permission::MembersManage)]
    public function delete(Request $request, string $organisationId, string $roleId): Response
    {
        $body = '' === $request->getContent() ? [] : Input::body($request, Type\shape(['replacement' => Type\optional(Type\nullable(Type\string()))]));
        $role = $this->roleManager->find($this->organisation($organisationId), $roleId);
        $this->roleManager->delete($role, $this->user(), $body['replacement'] ?? null);

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /** @return array<string, mixed> */
    private function role(Role $role): array
    {
        return [
            'id' => $role->getId()->toRfc4122(),
            'seededAs' => $role->getSeededAs()?->value,
            'name' => $role->getName(),
            'fixed' => $role->isOwner(),
            'removable' => null === $role->getSeededAs(),
            'permissions' => Vec\map($role->getPermissions(), static fn (Permission $permission): string => $permission->value),
            'holders' => $this->roleManager->holders($role),
        ];
    }

    private function organisation(string $id): Organisation
    {
        return $this->organisationRepository->find($id) ?? throw ApiException::notFound('Not found.');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'Please sign in to continue.');
    }
}
