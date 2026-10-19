<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Members;

use App\Entity\Membership;
use App\Entity\MembershipTransition;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Every way into an organisation, and every move inside one, recorded as a transition (sc-67). Flushing is the caller's. */
final readonly class MembershipMachine
{
    public function __construct(
        private MembershipRepository $membershipRepository,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
    ) {
    }

    /** A new row, or the account's old one when it left or was removed: one per account and organisation. */
    public function join(Organisation $organisation, User $user, Role $role, MembershipStatus $entry, MembershipChannel $channel, ?User $actor): Membership
    {
        $existing = $this->membershipRepository->findOneBy(['organisation' => $organisation, 'user' => $user]);

        if (null === $existing) {
            $membership = new Membership($organisation, $user, $role, $entry);
            $this->entityManager->persist($membership);
            $this->record($membership, null, $entry, $channel, $actor);

            return $membership;
        }

        $returning = MembershipStatus::LeftOrRemoved === $existing->getStatus();
        $approved = MembershipStatus::PendingApproval === $existing->getStatus() && MembershipStatus::Active === $entry;

        if (!$returning && !$approved) {
            throw new ApiException(ErrorCode::AlreadyAMember, $this->translator->trans('members.already_a_member'));
        }

        $existing->changeRole($role);
        $this->move($existing, $entry, $channel, $actor);

        return $existing;
    }

    public function move(Membership $membership, MembershipStatus $to, MembershipChannel $channel, ?User $actor): void
    {
        $from = $membership->getStatus();
        $membership->setStatus($to);
        $this->record($membership, $from, $to, $channel, $actor);
    }

    private function record(Membership $membership, ?MembershipStatus $from, MembershipStatus $to, MembershipChannel $channel, ?User $actor): void
    {
        $this->entityManager->persist(new MembershipTransition($membership, $from, $to, $channel, $actor, new DateTimeImmutable()));
    }
}
