<?php

declare(strict_types=1);

namespace App\Domain\Organisation\DomainJoining;

use App\Audit\Auditor;
use App\Domain\Organisation\Members\MembershipMachine;
use App\Entity\JoinOfferDismissal;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Http\Exception\ApiException;
use App\Repository\JoinOfferDismissalRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Asking to join through the company domain, taking the request back, and Not now. Flushing is the caller's. */
final readonly class JoinRequester
{
    public const string SUBJECT = 'Membership';

    public function __construct(
        private JoinOfferFinder $joinOfferFinder,
        private MembershipMachine $membershipMachine,
        private JoinOfferDismissalRepository $joinOfferDismissalRepository,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** Waits for somebody who manages members (sc-392), as Read-only until they choose a role. */
    public function ask(User $user, Organisation $organisation): Membership
    {
        if (!$this->joinOfferFinder->isOffered($user, $organisation)) {
            throw new ApiException(ErrorCode::JoinOfferUnavailable, $this->translator->trans('domain_joining.unavailable'));
        }

        $membership = $this->membershipMachine->join($organisation, $user, $this->readOnly($organisation), MembershipStatus::PendingApproval, MembershipChannel::Domain, $user);
        $this->auditor->record('domain_join.asked', self::SUBJECT, $membership->getId(), Actor::User, $user->getId(), $user->getName(), [
            'organisation' => [null, $organisation->getId()->toRfc4122()],
        ]);

        return $membership;
    }

    /** Start my own organisation instead: nobody becomes a member of a company long after leaving its queue. */
    public function withdraw(User $user): void
    {
        $pending = $this->joinOfferFinder->pendingRequestFor($user);

        if (null === $pending) {
            return;
        }

        $this->membershipMachine->move($pending, MembershipStatus::LeftOrRemoved, MembershipChannel::Domain, $user);
        $this->auditor->record('domain_join.withdrawn', self::SUBJECT, $pending->getId(), Actor::User, $user->getId(), $user->getName(), [
            'status' => [MembershipStatus::PendingApproval->value, MembershipStatus::LeftOrRemoved->value],
        ]);
    }

    public function dismiss(User $user, Organisation $organisation): void
    {
        if (null !== $this->joinOfferDismissalRepository->findOneBy(['user' => $user, 'organisation' => $organisation])) {
            return;
        }

        if (!$this->joinOfferFinder->isOffered($user, $organisation)) {
            throw new ApiException(ErrorCode::JoinOfferUnavailable, $this->translator->trans('domain_joining.unavailable'));
        }

        $this->entityManager->persist(new JoinOfferDismissal($user, $organisation, $this->clock->now()));
    }

    private function readOnly(Organisation $organisation): Role
    {
        return $this->entityManager->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => SeededRole::ReadOnly])
            ?? throw new ApiException(ErrorCode::InternalError, 'The organisation is missing a seeded role.');
    }
}
