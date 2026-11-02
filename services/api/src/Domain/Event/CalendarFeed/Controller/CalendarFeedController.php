<?php

declare(strict_types=1);

namespace App\Domain\Event\CalendarFeed\Controller;

use App\Domain\Event\CalendarFeed\FeedLinkIssuer;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\Policy\InOrganisation;
use App\Http\Exception\ApiException;
use App\Repository\OrganisationRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/** Calendar > Subscribe in your calendar app (sc-3626): the reader's own link for this organisation, and resetting it. */
#[InOrganisation(Permission::EventsRead)]
final readonly class CalendarFeedController
{
    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private FeedLinkIssuer $feedLinkIssuer,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** The path on this API; each client puts its own API address in front, as it does for every call. */
    #[Route('/api/orgs/{organisationId}/calendar-feed', name: 'orgs_calendar_feed', methods: ['GET'])]
    public function show(string $organisationId): JsonResponse
    {
        $feed = $this->feedLinkIssuer->linkFor($this->user(), $this->organisation($organisationId));

        return new JsonResponse(['path' => $this->feedLinkIssuer->pathOf($feed)]);
    }

    #[Route('/api/orgs/{organisationId}/calendar-feed/reset', name: 'orgs_calendar_feed_reset', methods: ['POST'])]
    public function reset(string $organisationId): JsonResponse
    {
        $feed = $this->feedLinkIssuer->linkFor($this->user(), $this->organisation($organisationId));
        $this->feedLinkIssuer->reset($feed);
        $this->entityManager->flush();

        return new JsonResponse(['path' => $this->feedLinkIssuer->pathOf($feed)]);
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
