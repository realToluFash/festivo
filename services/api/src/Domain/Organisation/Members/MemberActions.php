<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Members;

use App\Audit\Auditor;
use App\Domain\Organisation\DomainJoining\DomainSuspender;
use App\Domain\Organisation\OwnerClaims\OwnerClaimHandler;
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
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Settings > Members and General (sc-68): a role changed, a member removed or restored, a member leaving. Each is audited. */
final readonly class MemberActions
{
    public const string ROLE_CHANGED = 'membership.role_changed';
    public const string REMOVED = 'membership.removed';
    public const string LEFT = 'membership.left';

    public function __construct(
        private MembershipRepository $membershipRepository,
        private MembershipMachine $membershipMachine,
        private RoleAssignment $roleAssignment,
        private RoleManager $roleManager,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
        private DomainSuspender $domainSuspender,
        private ClockInterface $clock,
        private OwnerClaimHandler $ownerClaimHandler,
    ) {
    }

    /** Somebody else's membership here that has begun and not ended, a suspension past its instant ended first: a request to join is answered through JoinRequests (sc-392). */
    public function find(Organisation $organisation, string $membershipId, User $by): Membership
    {
        $this->domainSuspender->removeExpired($organisation);
        $membership = Uuid::isValid($membershipId)
            ? $this->membershipRepository->findOneBy(['id' => $membershipId, 'organisation' => $organisation])
            : null;

        if (null === $membership || MembershipStatus::LeftOrRemoved === $membership->getStatus() || MembershipStatus::PendingApproval === $membership->getStatus()) {
            throw ApiException::notFound('That person is not a member of this organisation.');
        }

        if ($membership->getUser()->getId()->equals($by->getId())) {
            throw new ApiException(ErrorCode::Conflict, $this->translator->trans('members.own_membership'));
        }

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
        $this->underLock($membership, function () use ($membership, $by): void {
            $removesAt = $membership->getRemovesAt();

            if (MembershipStatus::LeftOrRemoved === $membership->getStatus() || (null !== $removesAt && $removesAt <= $this->clock->now())) {
                throw ApiException::notFound('That person is not a member of this organisation.');
            }

            $this->roleAssignment->release($membership);
            $this->roleManager->mayGrant($membership->getOrganisation(), $by, $membership->getRole());
            $this->end($membership, self::REMOVED, $by);
        });
    }

    /** A member suspended when the company domain stopped bringing them in (sc-564), let back in: the only Owner by anyone holding members.manage, since nobody else could, which ends any claim to own it (sc-6640). */
    public function restore(Membership $membership, User $by): void
    {
        $this->underLock($membership, function () use ($membership, $by): void {
            if (!$this->roleAssignment->isLastOwner($membership)) {
                $this->roleManager->mayGrant($membership->getOrganisation(), $by, $membership->getRole());
            }

            $this->domainSuspender->restore($membership, $by);

            if ($membership->getRole()->isOwner()) {
                $this->ownerClaimHandler->ownerBack($membership->getOrganisation(), $by);
            }

            $this->entityManager->flush();
        });
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
        $status = $membership->getStatus();
        $this->membershipMachine->move($membership, MembershipStatus::LeftOrRemoved, MembershipChannel::Settings, $by);
        $this->record($action, $membership, $by, ['status' => [$status->value, MembershipStatus::LeftOrRemoved->value]]);
        $this->entityManager->flush();
    }

    /** Checked again on the locked row, as JoinRequests::answer does, so the per-minute removal and an admin never both end one suspension. */
    private function underLock(Membership $membership, callable $effect): void
    {
        $refused = $this->entityManager->wrapInTransaction(function () use ($membership, $effect): ?ApiException {
            $this->entityManager->refresh($membership, LockMode::PESSIMISTIC_WRITE);

            try {
                $effect();
            } catch (ApiException $exception) {
                return $exception;
            }

            return null;
        });

        if (null !== $refused) {
            throw $refused;
        }
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function record(string $action, Membership $membership, User $by, array $changes): void
    {
        $this->auditor->record($action, 'Membership', $membership->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
    }
}
