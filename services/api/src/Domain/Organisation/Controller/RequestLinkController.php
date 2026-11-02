<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\RequestLink\RequestLinkEditor;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Repository\OrganisationRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/** Settings > General > Requests to join (sc-562), for a role that manages members. */
#[InOrganisation(Permission::MembersManage)]
final readonly class RequestLinkController
{
    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private RequestLinkEditor $requestLinkEditor,
        private EntityManagerInterface $entityManager,
        private string $webOrigin,
    ) {
    }

    #[Route('/api/orgs/{organisationId}/request-link', name: 'orgs_request_link', methods: ['GET'])]
    public function show(string $organisationId): JsonResponse
    {
        return new JsonResponse($this->link($this->organisation($organisationId)));
    }

    #[Route('/api/orgs/{organisationId}/request-link', name: 'orgs_request_link_on', methods: ['PUT'])]
    public function turnOn(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $this->requestLinkEditor->turnOn($organisation, $this->user());
        $this->entityManager->flush();

        return new JsonResponse($this->link($organisation));
    }

    #[Route('/api/orgs/{organisationId}/request-link', name: 'orgs_request_link_off', methods: ['DELETE'])]
    public function turnOff(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $this->requestLinkEditor->turnOff($organisation, $this->user());
        $this->entityManager->flush();

        return new JsonResponse($this->link($organisation));
    }

    #[Route('/api/orgs/{organisationId}/request-link/replace', name: 'orgs_request_link_replace', methods: ['POST'])]
    public function replace(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $this->requestLinkEditor->replace($organisation, $this->user());
        $this->entityManager->flush();

        return new JsonResponse($this->link($organisation));
    }

    /** @return array{on: bool, url: ?string} */
    private function link(Organisation $organisation): array
    {
        $token = $organisation->getRequestLinkToken();

        return [
            'on' => null !== $token,
            'url' => null === $token ? null : Str\trim_right($this->webOrigin, '/') . '/join/' . $token,
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
