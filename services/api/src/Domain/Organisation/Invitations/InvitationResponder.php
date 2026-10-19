<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Invitations;

use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\User\EmailAddressNormaliser;
use App\Domain\User\Model\RegistrationResult;
use App\Domain\User\TokenIssuer;
use App\Domain\User\UserRegistrar;
use App\Entity\Invitation;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\InvitationStatus;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Http\Exception\ApiException;
use App\Repository\InvitationRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Type;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Matched on a verified address, never on holding the link: a leaked link answers nothing. */
final readonly class InvitationResponder
{
    public function __construct(
        private InvitationRepository $invitationRepository,
        private MembershipMachine $membershipMachine,
        private UserRegistrar $userRegistrar,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
    ) {
    }

    /** Any invitation the token names, whatever its state: the screen says which state it is in. */
    public function find(#[SensitiveParameter] string $token): Invitation
    {
        return $this->invitationRepository->findOneByHash(TokenIssuer::hash($token))
            ?? throw new ApiException(ErrorCode::InvitationNotFound, $this->translator->trans('invitations.not_found'));
    }

    /** The refusal this invitation answers with before anybody is asked who they are, or null while it can be answered. */
    public function refusalOf(Invitation $invitation): ?ErrorCode
    {
        if (null === $invitation->getOrganisation() || null === $invitation->getRole()) {
            return ErrorCode::OrganisationDeleted;
        }

        return match ($invitation->getStatusAt(new DateTimeImmutable())) {
            InvitationStatus::Pending => null,
            InvitationStatus::Accepted => ErrorCode::InvitationAccepted,
            InvitationStatus::Declined => ErrorCode::InvitationDeclined,
            InvitationStatus::Revoked => ErrorCode::InvitationRevoked,
            InvitationStatus::Expired => ErrorCode::InvitationExpired,
        };
    }

    public function isFor(Invitation $invitation, User $user): bool
    {
        return Iter\any(
            $user->getEmailAddresses(),
            static fn ($address): bool => $address->isVerified() && $address->getAddress() === $invitation->getEmail(),
        );
    }

    public function accept(Invitation $invitation, User $user): Membership
    {
        $this->refuseUnless($invitation, $user);

        return $this->entityManager->wrapInTransaction(function () use ($invitation, $user): Membership {
            $membership = $this->join($invitation, $user);
            $this->entityManager->flush();

            return $membership;
        });
    }

    /** Creates nothing: the invitation records the answer, and that is all. */
    public function decline(Invitation $invitation, User $user): Invitation
    {
        $this->refuseUnless($invitation, $user);
        $invitation->setStatus(InvitationStatus::Declined);
        $invitation->setDeclinedAt(new DateTimeImmutable());
        $this->entityManager->flush();

        return $invitation;
    }

    /** Every check runs before any write: a forwarded link must not hand over a verified address. */
    public function register(
        #[SensitiveParameter]
        string $token,
        string $email,
        string $name,
        #[SensitiveParameter]
        string $password,
        Request $request,
    ): RegistrationResult {
        $invitation = $this->find($token);
        $this->refuseUnanswerable($invitation);

        if (EmailAddressNormaliser::normalise($email) !== $invitation->getEmail()) {
            throw new ApiException(ErrorCode::InvitationNotYours, $this->translator->trans('invitations.not_yours'));
        }

        if ($this->userRegistrar->isTaken($invitation->getEmail())) {
            throw new ApiException(ErrorCode::EmailTaken, $this->translator->trans('invitations.email_taken'));
        }

        return $this->entityManager->wrapInTransaction(function () use ($invitation, $name, $password, $request): RegistrationResult {
            $result = $this->userRegistrar->registerFromInvitation($invitation, $name, $password, $request);
            $this->join($invitation, $result->user);
            $this->entityManager->flush();

            return $result;
        });
    }

    /** Its own state first, then whose it is: a mismatch leaves it pending. */
    private function refuseUnless(Invitation $invitation, User $user): void
    {
        $this->refuseUnanswerable($invitation);

        if (!$this->isFor($invitation, $user)) {
            throw new ApiException(ErrorCode::InvitationNotYours, $this->translator->trans('invitations.not_yours'));
        }
    }

    private function refuseUnanswerable(Invitation $invitation): void
    {
        $refusal = $this->refusalOf($invitation);

        if (null !== $refusal) {
            throw new ApiException($refusal, $this->translator->trans(match ($refusal) {
                ErrorCode::OrganisationDeleted => 'invitations.organisation_deleted',
                ErrorCode::InvitationAccepted => 'invitations.accepted',
                ErrorCode::InvitationDeclined => 'invitations.declined',
                ErrorCode::InvitationRevoked => 'invitations.revoked',
                default => 'invitations.expired',
            }));
        }
    }

    private function join(Invitation $invitation, User $user): Membership
    {
        $organisation = Type\instance_of(Organisation::class)->coerce($invitation->getOrganisation());
        $role = Type\instance_of(Role::class)->coerce($invitation->getRole());

        $membership = $this->membershipMachine->join($organisation, $user, $role, MembershipStatus::Active, MembershipChannel::Invitation, $user);
        $invitation->setStatus(InvitationStatus::Accepted);
        $invitation->setAcceptedAt(new DateTimeImmutable());
        $invitation->setAcceptedBy($user);

        return $membership;
    }
}
