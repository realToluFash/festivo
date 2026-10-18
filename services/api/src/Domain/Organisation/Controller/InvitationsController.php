<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Controller;

use App\Domain\Organisation\Http\MemberSerialiser;
use App\Domain\Organisation\Http\OrganisationSerialiser;
use App\Domain\Organisation\Invitations\InvitationResponder;
use App\Entity\Invitation;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\Authenticated;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Repository\InvitationRepository;
use DateTimeImmutable;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The person invited (sc-67): opening the link, the ones waiting in the product, and the answer. */
final readonly class InvitationsController
{
    public function __construct(
        private Security $security,
        private InvitationRepository $invitationRepository,
        private InvitationResponder $invitationResponder,
        private TranslatorInterface $translator,
    ) {
    }

    /** What the link opens onto, in whatever state it is, and whether the caller, if signed in, is the one invited. */
    #[Route('/api/invitations/link/{token}', name: 'invitations_link', methods: ['GET'])]
    #[PublicAccess]
    public function link(#[SensitiveParameter] string $token): JsonResponse
    {
        $user = $this->security->getUser();

        return new JsonResponse($this->preview($this->invitationResponder->find($token), $user instanceof User ? $user : null));
    }

    /** Pending, to any address the account has verified: somebody with an account can accept here as well as from the email. */
    #[Route('/api/invitations', name: 'invitations_mine', methods: ['GET'])]
    #[Authenticated]
    public function mine(): JsonResponse
    {
        $user = $this->user();
        $addresses = Vec\map(
            Vec\filter($user->getEmailAddresses(), static fn ($address): bool => $address->isVerified()),
            static fn ($address): string => $address->getAddress(),
        );
        $now = new DateTimeImmutable();
        $live = Vec\filter(
            $this->invitationRepository->findPendingTo($addresses),
            static fn (Invitation $invitation): bool => $invitation->getExpiresAt() > $now,
        );

        return new JsonResponse(['invitations' => Vec\map($live, fn (Invitation $invitation): array => $this->preview($invitation, $user))]);
    }

    #[Route('/api/invitations/{invitationId}/accept', name: 'invitations_accept', methods: ['POST'])]
    #[Authenticated]
    public function accept(string $invitationId): JsonResponse
    {
        $membership = $this->invitationResponder->accept($this->invitation($invitationId), $this->user());

        return new JsonResponse(['organisation' => OrganisationSerialiser::membership($membership)]);
    }

    #[Route('/api/invitations/{invitationId}/decline', name: 'invitations_decline', methods: ['POST'])]
    #[Authenticated]
    public function decline(string $invitationId): JsonResponse
    {
        $invitation = $this->invitationResponder->decline($this->invitation($invitationId), $this->user());

        return new JsonResponse(['status' => $invitation->getStatus()->value]);
    }

    /** @return array<string, mixed> */
    private function preview(Invitation $invitation, ?User $user): array
    {
        $role = $invitation->getRole();
        $inviter = $invitation->getInvitedBy();

        return [
            'id' => $invitation->getId()->toRfc4122(),
            'organisation' => [
                'id' => $invitation->getOrganisation()?->getId()->toRfc4122(),
                'name' => $invitation->getOrganisationName(),
            ],
            'email' => $invitation->getEmail(),
            'role' => null === $role ? null : MemberSerialiser::role($role),
            'invitedBy' => null === $inviter ? null : ['name' => $inviter->getName()],
            'expiresAt' => $invitation->getExpiresAt()->format(\DATE_ATOM),
            'refusal' => $this->invitationResponder->refusalOf($invitation)?->value,
            'forYou' => null === $user ? null : $this->invitationResponder->isFor($invitation, $user),
            'signedInAs' => $user?->getPrimaryEmailAddress()?->getAddress(),
        ];
    }

    private function invitation(string $id): Invitation
    {
        $invitation = Uuid::isValid($id) ? $this->invitationRepository->find($id) : null;

        return $invitation ?? throw new ApiException(ErrorCode::InvitationNotFound, $this->translator->trans('invitations.not_found'));
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'Please sign in to continue.');
    }
}
