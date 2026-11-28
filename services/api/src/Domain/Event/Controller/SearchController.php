<?php

declare(strict_types=1);

namespace App\Domain\Event\Controller;

use App\Domain\Event\Search\OrganisationSearch;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\EventScope;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventSearch;
use App\Repository\OrganisationRepository;
use Psl\Str;
use Psl\Type;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** The sidebar's Search (sc-39534): any member may ask, and each answer holds only what their role may open. */
final readonly class SearchController
{
    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private MembershipDirectoryInterface $membershipDirectory,
        private OrganisationSearch $organisationSearch,
    ) {
    }

    /** Which kinds the caller may find, for the field's words before anything is typed. */
    #[Route('/api/orgs/{organisationId}/search/reach', name: 'orgs_search_reach', methods: ['GET'])]
    #[InOrganisation(null)]
    public function reach(string $organisationId): JsonResponse
    {
        $organisation = $this->organisation($organisationId);

        return new JsonResponse($this->organisationSearch->reach($this->user(), $organisation, $this->scope($organisation)));
    }

    /** Up to five matches of each kind with the count of all; a kind the caller may not find is null. A term under two characters finds nothing. The app asks without invitations, which its Members does not list. */
    #[Route('/api/orgs/{organisationId}/search', name: 'orgs_search', methods: ['GET'])]
    #[InOrganisation(null)]
    public function search(Request $request, string $organisationId): JsonResponse
    {
        $query = Input::query($request, Type\shape([
            'q' => Type\optional(Type\string()),
            'invitations' => Type\optional(Type\union(Type\literal_scalar('true'), Type\literal_scalar('false'))),
        ]));
        $term = Str\trim($query['q'] ?? '');
        $organisation = $this->organisation($organisationId);
        $found = $this->organisationSearch->find(
            $this->user(),
            $organisation,
            $this->scope($organisation),
            Str\length($term) < EventSearch::SHORTEST_TERM ? null : $term,
            'false' !== ($query['invitations'] ?? 'true'),
        );

        return new JsonResponse($found);
    }

    private function scope(Organisation $organisation): EventScope
    {
        return $this->membershipDirectory->eventScopeIn($this->user(), $organisation->getId()) ?? throw ApiException::notFound('access.not_found');
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
