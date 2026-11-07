<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Members;

use App\Audit\Auditor;
use App\Domain\Organisation\Roles\RoleAssignment;
use App\Domain\Organisation\Roles\RoleManager;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Somebody awaiting approval (sc-392): approved into a role, turned down, or removed unanswered at their request's instant. */
final readonly class JoinRequests
{
    public const string APPROVED = 'membership.approved';
    public const string TURNED_DOWN = 'membership.turned_down';
    public const string EXPIRED = 'membership.request_expired';

    private const string SUBJECT = 'Membership';
    private const string NOTICE_INTERVAL = 'PT24H';

    public function __construct(
        private MembershipRepository $membershipRepository,
        private MembershipMachine $membershipMachine,
        private MembershipDirectoryInterface $membershipDirectory,
        private RoleAssignment $roleAssignment,
        private RoleManager $roleManager,
        private JoinRequestMailer $joinRequestMailer,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** Never into Owner: somebody nobody inside chose is let in at least privilege, and made an owner later from Members. */
    public function approve(Organisation $organisation, string $membershipId, Role $role, User $by): Membership
    {
        if ($role->isOwner()) {
            throw ApiException::validation([[
                'propertyPath' => 'roleId',
                'message' => $this->translator->trans('members.approve_not_owner'),
                'code' => ErrorCode::ValidationFailed->value,
            ]]);
        }

        $this->roleManager->mayGrant($organisation, $by, $role);

        return $this->answer($organisation, $membershipId, $by, function (Membership $membership) use ($role, $by): void {
            $before = $membership->getRole();
            $this->roleAssignment->assign($membership, $role);
            $this->membershipMachine->move($membership, MembershipStatus::Active, MembershipChannel::Settings, $by);
            $this->record(self::APPROVED, $membership, $by, [
                'status' => [MembershipStatus::PendingApproval->value, MembershipStatus::Active->value],
                'roleId' => [$before->getId()->toRfc4122(), $role->getId()->toRfc4122()],
            ]);
        });
    }

    public function turnDown(Organisation $organisation, string $membershipId, User $by): Membership
    {
        $membership = $this->answer($organisation, $membershipId, $by, function (Membership $membership) use ($by): void {
            $this->membershipMachine->move($membership, MembershipStatus::LeftOrRemoved, MembershipChannel::Settings, $by);
            $this->record(self::TURNED_DOWN, $membership, $by, [
                'status' => [MembershipStatus::PendingApproval->value, MembershipStatus::LeftOrRemoved->value],
            ]);
        });
        $this->joinRequestMailer->sendTurnedDown($membership);

        return $membership;
    }

    /** @return int how many were removed, each as of its own instant rather than this run */
    public function expireDue(?Organisation $organisation = null): int
    {
        $expired = 0;

        foreach ($this->membershipRepository->findRequestsLapsedBy($this->clock->now(), $organisation) as $membership) {
            $at = $this->entityManager->wrapInTransaction(function () use ($membership): ?DateTimeImmutable {
                $this->entityManager->refresh($membership, LockMode::PESSIMISTIC_WRITE);
                $at = $membership->getRequestExpiresAt();

                if (MembershipStatus::PendingApproval !== $membership->getStatus() || null === $at || $at > $this->clock->now()) {
                    return null;
                }

                $this->membershipMachine->move($membership, MembershipStatus::LeftOrRemoved, MembershipChannel::Settings, null, $at);
                $this->auditor->record(self::EXPIRED, self::SUBJECT, $membership->getId(), changes: [
                    'status' => [MembershipStatus::PendingApproval->value, MembershipStatus::LeftOrRemoved->value],
                ]);
                $this->entityManager->flush();

                return $at;
            });

            if (null === $at) {
                continue;
            }

            $this->joinRequestMailer->sendExpired($membership, $at);
            ++$expired;
        }

        return $expired;
    }

    /** @return int how many organisations were told of new requests, at most once in any 24 hours each */
    public function noticeDue(): int
    {
        $now = $this->clock->now();
        $lifetime = new DateInterval(Membership::UNANSWERED_FOR);
        $waiting = Dict\group_by(
            $this->membershipRepository->findRequestsWaitingAt($now),
            static fn (Membership $membership): string => $membership->getOrganisation()->getId()->toRfc4122(),
        );
        $told = 0;

        foreach ($waiting as $requests) {
            $organisation = $requests[0]->getOrganisation();
            $noticed = $organisation->getJoinRequestsNoticedAt();

            if (null !== $noticed && $noticed > $now->sub(new DateInterval(self::NOTICE_INTERVAL))) {
                continue;
            }

            $unnoticed = Vec\filter(
                $requests,
                static fn (Membership $membership): bool => null === $noticed || ($membership->getRequestExpiresAt()?->sub($lifetime) ?? $now) > $noticed,
            );

            if ([] === $unnoticed) {
                continue;
            }

            $organisation->setJoinRequestsNoticedAt($now);
            $this->entityManager->flush();
            $this->joinRequestMailer->sendWaiting($organisation, $this->deciders($organisation), $requests);
            ++$told;
        }

        return $told;
    }

    /** @return list<User> the active members who hold the permission to manage members, as it is read today */
    public function deciders(Organisation $organisation): array
    {
        return Vec\map(
            Vec\filter(
                $this->membershipRepository->findActiveIn($organisation),
                fn (Membership $membership): bool => true === $this->membershipDirectory->grantsIn($membership->getUser(), $organisation->getId())?->holds(Permission::MembersManage),
            ),
            static fn (Membership $membership): User => $membership->getUser(),
        );
    }

    /** @param callable(Membership): void $effect */
    private function answer(Organisation $organisation, string $membershipId, User $by, callable $effect): Membership
    {
        $this->expireDue($organisation);
        $membership = Uuid::isValid($membershipId)
            ? $this->membershipRepository->findOneBy(['id' => $membershipId, 'organisation' => $organisation])
            : null;

        if (null === $membership) {
            throw ApiException::notFound('members.not_asked');
        }

        if ($membership->getUser()->getId()->equals($by->getId())) {
            throw new ApiException(ErrorCode::Conflict, $this->translator->trans('members.own_membership'));
        }

        $answered = $this->entityManager->wrapInTransaction(function () use ($membership, $effect): Membership|ApiException {
            $this->entityManager->refresh($membership, LockMode::PESSIMISTIC_WRITE);

            if (!$membership->isAwaitingApprovalAt($this->clock->now())) {
                return new ApiException(ErrorCode::JoinRequestAnswered, $this->translator->trans('members.request_answered'));
            }

            $effect($membership);
            $this->entityManager->flush();

            return $membership;
        });

        return $answered instanceof ApiException ? throw $answered : $answered;
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function record(string $action, Membership $membership, User $by, array $changes): void
    {
        $this->auditor->record($action, self::SUBJECT, $membership->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
    }
}
