<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\DomainJoining\JoinOfferFinder;
use App\Domain\Organisation\DomainJoining\JoinRequester;
use App\Domain\Organisation\Http\JoinRequestSerialiser;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\Authenticated;
use App\Http\Exception\ApiException;
use App\Repository\OrganisationRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The person at a listed domain (sc-561): the organisations they may ask to join, and their request. */
#[Authenticated]
final readonly class JoinOffersController
{
    public function __construct(
        private Security $security,
        private OrganisationRepository $organisationRepository,
        private JoinOfferFinder $joinOfferFinder,
        private JoinRequester $joinRequester,
        private JoinRequestSerialiser $joinRequestSerialiser,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
    ) {
    }

    /** On the onboarding gate's exempt list: "A few details" shows these before the account is complete. */
    #[Route('/api/join-offers', name: 'join_offers', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $user = $this->user();
        $pending = $this->joinOfferFinder->pendingRequestFor($user);

        return new JsonResponse([
            'domain' => JoinOfferFinder::domainFor($user),
            'offers' => Vec\map($this->joinOfferFinder->offersFor($user), JoinRequestSerialiser::organisation(...)),
            'request' => null === $pending ? null : $this->joinRequestSerialiser->request($pending),
        ]);
    }

    /** From the switcher; "A few details" asks through its own save, which saves the details too. */
    #[Route('/api/join-offers/{organisationId}/ask', name: 'join_offers_ask', methods: ['POST'])]
    public function ask(string $organisationId): JsonResponse
    {
        $membership = $this->joinRequester->ask($this->user(), $this->organisation($organisationId));
        $this->entityManager->flush();

        return new JsonResponse(['request' => $this->joinRequestSerialiser->request($membership)], Response::HTTP_CREATED);
    }

    #[Route('/api/join-offers/{organisationId}/dismiss', name: 'join_offers_dismiss', methods: ['POST'])]
    public function dismiss(string $organisationId): JsonResponse
    {
        $this->joinRequester->dismiss($this->user(), $this->organisation($organisationId));
        $this->entityManager->flush();

        return new JsonResponse(null, Response::HTTP_NO_CONTENT);
    }

    /** Taking it back is idempotent: a request already answered has nothing left to withdraw. */
    #[Route('/api/join-offers/request', name: 'join_offers_withdraw', methods: ['DELETE'])]
    public function withdraw(): JsonResponse
    {
        $this->joinRequester->withdraw($this->user());
        $this->entityManager->flush();

        return new JsonResponse(null, Response::HTTP_NO_CONTENT);
    }

    /** Unknown and not offered read the same, so the answer says nothing about an organisation the caller cannot ask. */
    private function organisation(string $id): Organisation
    {
        $organisation = Uuid::isValid($id) ? $this->organisationRepository->find($id) : null;

        return $organisation ?? throw new ApiException(ErrorCode::JoinOfferUnavailable, $this->translator->trans('domain_joining.unavailable'));
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'Please sign in to continue.');
    }
}
