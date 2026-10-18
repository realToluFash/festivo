<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Invitations;

use App\Audit\Auditor;
use App\Domain\User\EmailAddressNormaliser;
use App\Domain\User\TokenIssuer;
use App\Entity\Invitation;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\InvitationDelivery;
use App\Enum\InvitationStatus;
use App\Enum\MembershipStatus;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use App\Repository\EmailAddressRepository;
use App\Repository\InvitationRepository;
use App\Repository\MembershipRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\SecureRandom;
use Psl\Str;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Contracts\Translation\TranslatorInterface;
use Throwable;

/** Sending, re-sending and revoking an invitation (sc-67). */
final readonly class InvitationSender
{
    private const int TOKEN_BYTES = 32;

    public function __construct(
        private InvitationRepository $invitationRepository,
        private MembershipRepository $membershipRepository,
        private EmailAddressRepository $emailAddressRepository,
        private MembershipDirectoryInterface $membershipDirectory,
        private InvitationMailer $invitationMailer,
        private AfterResponse $afterResponse,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
    ) {
    }

    /** Re-inviting an address with one pending replaces its token rather than adding a second row. */
    public function invite(Organisation $organisation, string $email, Role $role, User $by, ?Request $request = null): Invitation
    {
        $address = $this->address($email);
        $this->mayGrant($organisation, $role, $by);

        $member = $this->membershipRepository->findOneByAddress($organisation, $address);

        if (null !== $member && Iter\contains([MembershipStatus::Active, MembershipStatus::Suspended], $member->getStatus())) {
            throw new ApiException(ErrorCode::AlreadyAMember, $this->translator->trans('members.already_a_member_named', [
                '{email}' => $address,
                '{organisation}' => $organisation->getName(),
            ]));
        }

        $token = \bin2hex(SecureRandom\bytes(self::TOKEN_BYTES));
        $expiresAt = new DateTimeImmutable()->modify(Str\format('+%d days', Invitation::LIFETIME_DAYS));
        $invitation = $this->invitationRepository->findPending($organisation, $address);

        if (null === $invitation) {
            $invitation = new Invitation($organisation, $address, $role, $by, TokenIssuer::hash($token), $expiresAt);
            $this->entityManager->persist($invitation);
        } else {
            $invitation->setTokenHash(TokenIssuer::hash($token));
            $invitation->setExpiresAt($expiresAt);
            $invitation->setRole($role);
            $invitation->setInvitedBy($by);
            $invitation->setOrganisationName($organisation->getName());
            $invitation->setDelivery(InvitationDelivery::Queued);
            $invitation->setSentAt(null);
        }

        $this->auditor->record('invitation.sent', 'Invitation', $invitation->getId(), Actor::User, $by->getId(), $by->getName(), [
            'email' => [null, $address],
            'role' => [null, $role->getId()->toRfc4122()],
        ]);
        $this->entityManager->flush();

        $held = $this->emailAddressRepository->findOneByAddress($address);
        $recipient = true === $held?->isVerified() ? $held->getUser() : null;
        $asked = $request?->getLocale();
        $this->afterResponse->defer(fn () => $this->deliver($invitation, $token, $recipient, $asked));

        return $invitation;
    }

    public function revoke(Invitation $invitation, User $by): void
    {
        if (InvitationStatus::Pending !== $invitation->getStatus()) {
            throw new ApiException(ErrorCode::Conflict, $this->translator->trans('invitations.not_pending'));
        }

        $invitation->setStatus(InvitationStatus::Revoked);
        $invitation->setRevokedAt(new DateTimeImmutable());
        $this->auditor->record('invitation.revoked', 'Invitation', $invitation->getId(), Actor::User, $by->getId(), $by->getName(), [
            'status' => [InvitationStatus::Pending->value, InvitationStatus::Revoked->value],
        ]);
        $this->entityManager->flush();
    }

    private function deliver(Invitation $invitation, #[SensitiveParameter] string $token, ?User $recipient, ?string $asked): void
    {
        try {
            $this->invitationMailer->send($invitation, $token, $recipient, $asked);
            $invitation->setDelivery(InvitationDelivery::Sent);
            $invitation->setSentAt(new DateTimeImmutable());
        } catch (Throwable $e) {
            $invitation->setDelivery(InvitationDelivery::Failed);
            $this->entityManager->flush();

            throw $e;
        }

        $this->entityManager->flush();
    }

    private function address(string $email): string
    {
        $address = EmailAddressNormaliser::normalise($email);

        if ('' === $address) {
            throw $this->invalid('email', 'validation.invite_email_required');
        }

        if (!\filter_var($address, \FILTER_VALIDATE_EMAIL)) {
            throw $this->invalid('email', 'validation.invite_email_invalid');
        }

        return $address;
    }

    /** As with roles (sc-66): an inviter grants only what they hold, and only an owner makes an owner. */
    private function mayGrant(Organisation $organisation, Role $role, User $by): void
    {
        $grants = $this->membershipDirectory->grantsIn($by, $organisation->getId());
        $byOwner = true === $this->membershipRepository->findActive($by, $organisation->getId())?->getRole()->isOwner();

        $held = null !== $grants
            && ($byOwner || !$role->isOwner())
            && Iter\all($role->getPermissions(), $grants->holds(...));

        if (!$held) {
            throw new ApiException(ErrorCode::GrantNotHeld, $this->translator->trans('roles.grant_not_held'));
        }
    }

    private function invalid(string $field, string $key): ApiException
    {
        return ApiException::validation([[
            'propertyPath' => $field,
            'message' => $this->translator->trans($key),
            'code' => ErrorCode::ValidationFailed->value,
        ]]);
    }
}
