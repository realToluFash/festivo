<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\OwnerClaims\OwnerClaimDescriber;
use App\Domain\Organisation\OwnerClaims\OwnerClaimHandler;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\Authenticated;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\OrganisationRepository;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** The Members banner while an organisation has no active Owner (sc-6640): `ownerClaim` is null for anybody it is not shown to. */
final readonly class OwnerClaimController
{
    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private OwnerClaimHandler $ownerClaimHandler,
        private OwnerClaimDescriber $ownerClaimDescriber,
    ) {
    }

    #[Route('/api/orgs/{organisationId}/owner-claim', name: 'orgs_owner_claim', methods: ['GET'])]
    #[InOrganisation(Permission::MembersRead)]
    public function show(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $this->ownerClaimHandler->settleDue($organisation);

        return $this->banner($organisation);
    }

    /** Refused `owner_claim_address`, `owner_claim_managed`, `owner_claim_open` or `owner_claim_closed`, each worded for the banner. */
    #[Route('/api/orgs/{organisationId}/owner-claim', name: 'orgs_owner_claim_start', methods: ['POST'])]
    #[InOrganisation(Permission::MembersRead)]
    public function start(Request $request, string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $body = Input::body($request, Type\shape(['domain' => Type\string()]));
        $this->ownerClaimHandler->start($organisation, $this->user(), $body['domain']);

        return $this->banner($organisation, Response::HTTP_CREATED);
    }

    #[Route('/api/orgs/{organisationId}/owner-claim/check', name: 'orgs_owner_claim_check', methods: ['POST'])]
    #[InOrganisation(Permission::MembersRead)]
    public function check(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $claim = $this->ownerClaimHandler->check($organisation, $this->user());

        return $this->banner($organisation, extra: ['found' => null !== $claim->getFoundAt()]);
    }

    /** A suspended Owner may stop it too, so this is any account's, and OwnerClaimHandler::stop decides who. */
    #[Route('/api/orgs/{organisationId}/owner-claim/stop', name: 'orgs_owner_claim_stop', methods: ['POST'])]
    #[Authenticated]
    public function stop(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $this->ownerClaimHandler->stop($organisation, $this->user());

        return $this->banner($organisation);
    }

    /** @param array<string, mixed> $extra */
    private function banner(Organisation $organisation, int $status = Response::HTTP_OK, array $extra = []): JsonResponse
    {
        return new JsonResponse([
            'ownerClaim' => $this->ownerClaimDescriber->forMembers($organisation, $this->user()),
            ...$extra,
        ], $status);
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
