<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\DomainJoining\CompanyDomainEditor;
use App\Entity\Organisation;
use App\Entity\OrganisationDomain;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\OrganisationDomainRepository;
use App\Repository\OrganisationRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Type;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** Settings > General > Company domain joining (sc-561), for a role that manages members. */
#[InOrganisation(Permission::MembersManage)]
final readonly class CompanyDomainsController
{
    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private OrganisationDomainRepository $organisationDomainRepository,
        private CompanyDomainEditor $companyDomainEditor,
        private EntityManagerInterface $entityManager,
    ) {
    }

    #[Route('/api/orgs/{organisationId}/domains', name: 'orgs_domains', methods: ['GET'])]
    public function list(string $organisationId): JsonResponse
    {
        return new JsonResponse($this->domains($this->organisation($organisationId)));
    }

    #[Route('/api/orgs/{organisationId}/domains', name: 'orgs_domains_add', methods: ['POST'])]
    public function add(Request $request, string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);
        $body = Input::body($request, Type\shape(['domain' => Type\string()]));

        $this->companyDomainEditor->add($organisation, $this->user(), $body['domain']);
        $this->entityManager->flush();

        return new JsonResponse($this->domains($organisation), Response::HTTP_CREATED);
    }

    #[Route('/api/orgs/{organisationId}/domains/{domain}', name: 'orgs_domains_remove', methods: ['DELETE'])]
    public function remove(string $organisationId, string $domain): JsonResponse
    {
        $organisation = $this->organisation($organisationId);

        $this->companyDomainEditor->remove($organisation, $this->user(), $domain);
        $this->entityManager->flush();

        return new JsonResponse($this->domains($organisation));
    }

    /** @return array<string, mixed> with the caller's own address, which the help line names */
    private function domains(Organisation $organisation): array
    {
        return [
            'domains' => Vec\map(
                $this->organisationDomainRepository->findForOrganisation($organisation),
                fn (OrganisationDomain $listing): array => [
                    'domain' => $listing->getDomain(),
                    'stopped' => $this->companyDomainEditor->isStopped($listing),
                ],
            ),
            'most' => CompanyDomainEditor::MOST,
            'ownAddress' => $this->user()->getPrimaryEmailAddress()?->getAddress(),
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
