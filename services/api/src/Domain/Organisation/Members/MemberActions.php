<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Members;

use App\Audit\Auditor;
use App\Domain\Organisation\Handover\WorkHandover;
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
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Settings > Members and General (sc-68): a role changed, a member removed, a member leaving. Each is audited. */
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
        private WorkHandover $workHandover,
    ) {
    }

    /** Somebody else's membership here that has not ended: a former one, or another organisation's, is not found. */
    public function find(Organisation $organisation, string $membershipId, User $by): Membership
    {
        $membership = Uuid::isValid($membershipId)
            ? $this->membershipRepository->findOneBy(['id' => $membershipId, 'organisation' => $organisation])
            : null;

        if (null === $membership || MembershipStatus::LeftOrRemoved === $membership->getStatus()) {
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

    /** What they are responsible for goes to `$handTo`'s member (sc-614), who is required when there is any. */
    public function remove(Membership $membership, User $by, ?string $handTo = null, ?string $asked = null): void
    {
        $this->roleManager->mayGrant($membership->getOrganisation(), $by, $membership->getRole());
        $this->roleAssignment->release($membership);
        $this->pass($membership, $by, $handTo, $asked);
        $this->end($membership, self::REMOVED, $by);
    }

    /** With no `$handTo`, what they are responsible for goes to the longest-standing other Owner, and every Owner is emailed. */
    public function leave(Organisation $organisation, User $user, ?string $handTo = null, ?string $asked = null): void
    {
        $membership = $this->membershipRepository->findActive($user, $organisation->getId())
            ?? throw ApiException::notFound('Not found.');
        $this->roleAssignment->release($membership);
        $work = $this->workHandover->heldBy($membership);

        if ([] !== $work) {
            $to = null !== $handTo
                ? $this->workHandover->recipient($membership, $handTo)
                : ($this->workHandover->owners($membership)[0] ?? throw new ApiException(ErrorCode::LastOwner, $this->translator->trans('roles.last_owner')));
            $this->workHandover->hand($membership, $work, $to, $user, null === $handTo, $asked);
        }

        $this->end($membership, self::LEFT, $user);
    }

    /** Hand over now (sc-614), for a member who is still here, suspended or not: the membership stays as it is. */
    public function handOver(Membership $membership, User $by, ?string $handTo, ?string $asked = null): void
    {
        $this->roleManager->mayGrant($membership->getOrganisation(), $by, $membership->getRole());
        $this->pass($membership, $by, $handTo, $asked);
        $this->entityManager->flush();
    }

    private function pass(Membership $membership, User $by, ?string $handTo, ?string $asked): void
    {
        $work = $this->workHandover->heldBy($membership);

        if ([] !== $work) {
            $this->workHandover->hand($membership, $work, $this->workHandover->recipient($membership, $handTo), $by, false, $asked);
        }
    }

    private function end(Membership $membership, string $action, User $by): void
    {
        $status = $membership->getStatus();
        $this->membershipMachine->move($membership, MembershipStatus::LeftOrRemoved, MembershipChannel::Settings, $by);
        $this->record($action, $membership, $by, ['status' => [$status->value, MembershipStatus::LeftOrRemoved->value]]);
        $this->entityManager->flush();
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function record(string $action, Membership $membership, User $by, array $changes): void
    {
        $this->auditor->record($action, 'Membership', $membership->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
    }
}
