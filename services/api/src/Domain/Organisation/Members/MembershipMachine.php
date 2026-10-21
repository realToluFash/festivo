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
use App\Enum\SeededRole;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Every way into an organisation, and every move inside one, recorded as a transition (sc-67). Flushing is the caller's. */
final readonly class MembershipMachine
{
    public function __construct(
        private MembershipRepository $membershipRepository,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** A new row, or the account's old one when it left or was removed: one per account and organisation. */
    public function join(Organisation $organisation, User $user, Role $role, MembershipStatus $entry, MembershipChannel $channel, ?User $actor): Membership
    {
        $existing = $this->membershipRepository->findOneBy(['organisation' => $organisation, 'user' => $user]);

        if (null === $existing) {
            $now = $this->clock->now();
            $membership = new Membership($organisation, $user, $role, $entry, $now);
            $this->entityManager->persist($membership);
            $this->record($membership, null, $entry, $channel, $actor, $now);

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

    /** A request to join, through any channel, waits for somebody who manages members (sc-392), as Read-only until they choose a role. */
    public function ask(Organisation $organisation, User $user, MembershipChannel $channel): Membership
    {
        $readOnly = $this->entityManager->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => SeededRole::ReadOnly])
            ?? throw new ApiException(ErrorCode::InternalError, 'The organisation is missing a seeded role.');

        return $this->join($organisation, $user, $readOnly, MembershipStatus::PendingApproval, $channel, $user);
    }

    /** `$at` is the instant it happened, when that is not now: a request removed at its deadline (sc-392). */
    public function move(Membership $membership, MembershipStatus $to, MembershipChannel $channel, ?User $actor, ?DateTimeImmutable $at = null): void
    {
        $now = $at ?? $this->clock->now();
        $from = $membership->getStatus();
        $membership->setStatus($to, $now);
        $this->record($membership, $from, $to, $channel, $actor, $now);
    }

    private function record(Membership $membership, ?MembershipStatus $from, MembershipStatus $to, MembershipChannel $channel, ?User $actor, DateTimeImmutable $at): void
    {
        $this->entityManager->persist(new MembershipTransition($membership, $from, $to, $channel, $actor, $at));
    }
}
