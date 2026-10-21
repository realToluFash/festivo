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
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Settings > Members and General (sc-68): a role changed, a member suspended, restored or removed, a member leaving. Each is audited. */
final readonly class MemberActions
{
    public const string ROLE_CHANGED = 'membership.role_changed';
    public const string REMOVED = 'membership.removed';
    public const string LEFT = 'membership.left';
    public const string SUSPENDED = 'membership.suspended';
    public const string RESTORED = 'membership.restored';

    public function __construct(
        private MembershipRepository $membershipRepository,
        private MembershipMachine $membershipMachine,
        private RoleAssignment $roleAssignment,
        private RoleManager $roleManager,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
        private TeamSeats $teamSeats,
        private AfterResponse $afterResponse,
        private MemberAccessMailer $memberAccessMailer,
    ) {
    }

    /** Somebody else's membership here that has not ended: a former one, or another organisation's, is not found. */
    public function find(Organisation $organisation, string $membershipId, User $by): Membership
    {
        $membership = $this->current($organisation, $membershipId);

        if ($this->isOwn($membership, $by)) {
            throw new ApiException(ErrorCode::Conflict, $this->translator->trans('members.own_membership'));
        }

        return $membership;
    }

    /** Access pauses and everything else is kept: the row, its role, its events and its history. Never yourself, never an Owner. */
    public function suspend(Organisation $organisation, string $membershipId, User $by): Membership
    {
        $membership = $this->current($organisation, $membershipId);

        if ($this->isOwn($membership, $by)) {
            throw ApiException::forbidden($this->translator->trans('members.suspend_self'));
        }

        if ($membership->getRole()->isOwner()) {
            throw ApiException::forbidden($this->translator->trans('members.suspend_owner'));
        }

        if (MembershipStatus::Active !== $membership->getStatus()) {
            throw ApiException::conflict($this->translator->trans('members.not_active'));
        }

        $this->roleManager->mayGrant($organisation, $by, $membership->getRole());

        $this->transition($membership, MembershipStatus::Suspended, self::SUSPENDED, $by);
        $at = new DateTimeImmutable();
        $this->afterResponse->defer(fn () => $this->memberAccessMailer->sendSuspended($membership, $at));

        return $membership;
    }

    /** Back to active with the role they held, if a team seat is free: a restore is a way in, counted as an invitation is. */
    public function restore(Organisation $organisation, string $membershipId, User $by): Membership
    {
        $membership = $this->current($organisation, $membershipId);

        if (MembershipStatus::Suspended !== $membership->getStatus()) {
            throw ApiException::conflict($this->translator->trans('members.not_suspended'));
        }

        $this->teamSeats->requireFree($organisation);
        $this->transition($membership, MembershipStatus::Active, self::RESTORED, $by);
        $at = new DateTimeImmutable();
        $this->afterResponse->defer(fn () => $this->memberAccessMailer->sendRestored($membership, $at));

        return $membership;
    }

    /** Nobody moves a member out of a role they could not grant, or into one: only an owner touches an owner. */
    public function changeRole(Membership $membership, Role $role, User $by): void
    {
        $before = $membership->getRole();
        $this->roleManager->mayGrant($membership->getOrganisation(), $by, $before);
        $this->roleManager->mayGrant($membership->getOrganisation(), $by, $role);

        if ($before->getId()->equals($role->getId())) {
            return;
        }

        $this->roleAssignment->assign($membership, $role);
        $this->record(self::ROLE_CHANGED, $membership, $by, ['roleId' => [$before->getId()->toRfc4122(), $role->getId()->toRfc4122()]]);
        $this->entityManager->flush();
    }

    /** Their events stay with the organisation: only the membership ends, and its history is kept. */
    public function remove(Membership $membership, User $by): void
    {
        $this->roleManager->mayGrant($membership->getOrganisation(), $by, $membership->getRole());
        $this->roleAssignment->release($membership);
        $this->end($membership, self::REMOVED, $by);
    }

    public function leave(Organisation $organisation, User $user): void
    {
        $membership = $this->membershipRepository->findActive($user, $organisation->getId())
            ?? throw ApiException::notFound('Not found.');
        $this->roleAssignment->release($membership);
        $this->end($membership, self::LEFT, $user);
    }

    private function end(Membership $membership, string $action, User $by): void
    {
        $this->transition($membership, MembershipStatus::LeftOrRemoved, $action, $by);
    }

    private function transition(Membership $membership, MembershipStatus $to, string $action, User $by): void
    {
        $status = $membership->getStatus();
        $this->membershipMachine->move($membership, $to, MembershipChannel::Settings, $by);
        $this->record($action, $membership, $by, ['status' => [$status->value, $to->value]]);
        $this->entityManager->flush();
    }

    /** Somebody's membership here that has not ended: a former one, or another organisation's, is not found. */
    private function current(Organisation $organisation, string $membershipId): Membership
    {
        $membership = Uuid::isValid($membershipId)
            ? $this->membershipRepository->findOneBy(['id' => $membershipId, 'organisation' => $organisation])
            : null;

        if (null === $membership || MembershipStatus::LeftOrRemoved === $membership->getStatus()) {
            throw ApiException::notFound('That person is not a member of this organisation.');
        }

        return $membership;
    }

    private function isOwn(Membership $membership, User $by): bool
    {
        return $membership->getUser()->getId()->equals($by->getId());
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function record(string $action, Membership $membership, User $by, array $changes): void
    {
        $this->auditor->record($action, 'Membership', $membership->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
    }
}
