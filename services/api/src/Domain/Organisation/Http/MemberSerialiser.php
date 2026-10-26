<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Http;

use App\Entity\Invitation;
use App\Entity\Membership;
use App\Entity\MembershipTransition;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\MembershipStatus;
use Closure;
use DateTimeImmutable;
use DateTimeInterface;
use Psl\Iter;
use Psl\Vec;

/** Settings > Organisation > Members (sc-67): what an administrator reads. Delivery is support's and is not here. */
final readonly class MemberSerialiser
{
    /**
     * @param list<MembershipTransition>         $history    this membership's, oldest first
     * @param list<Invitation>                   $accepted   invitations this member accepted here
     * @param Closure(DateTimeImmutable): string $written    a deadline as the caller reads it (sc-868)
     * @param array<string, mixed>|null          $suspension MemberSuspension::describe(), for the caller
     *
     * @return array<string, mixed>
     */
    public static function member(Membership $membership, array $history, array $accepted, User $caller, Closure $written, ?array $suspension = null): array
    {
        $user = $membership->getUser();
        $last = Iter\last($history);
        $entered = Iter\last(Vec\filter($history, static fn (MembershipTransition $step): bool => $step->getToStatus()->isEntry() && self::fromOutside($step)));
        $invitation = Iter\last($accepted);
        $removesAt = MembershipStatus::PendingApproval === $membership->getStatus() ? $membership->getRequestExpiresAt() : null;

        return [
            'id' => $membership->getId()->toRfc4122(),
            'user' => [
                'id' => $user->getId()->toRfc4122(),
                'name' => $user->getName(),
                'email' => $user->getPrimaryEmailAddress()?->getAddress(),
            ],
            'role' => self::role($membership->getRole()),
            'status' => $membership->getStatus()->value,
            'former' => MembershipStatus::LeftOrRemoved === $membership->getStatus() ? self::former($last, $user) : null,
            'channel' => $entered?->getChannel()->value,
            'suspension' => $suspension,
            'message' => MembershipStatus::PendingApproval === $membership->getStatus() ? $membership->getRequestMessage() : null,
            'since' => self::at($last?->getOccurredAt()),
            'removesAt' => null === $removesAt ? null : ['at' => self::at($removesAt), 'written' => $written($removesAt)],
            'invitedBy' => null === $invitation ? null : self::person($invitation->getInvitedBy()),
            'invitedAt' => self::at($invitation?->getSentAt() ?? $invitation?->getCreatedAt()),
            'self' => $user->getId()->equals($caller->getId()),
            'history' => Vec\map($history, static fn (MembershipTransition $step): array => [
                'from' => $step->getFromStatus()?->value,
                'to' => $step->getToStatus()->value,
                'channel' => $step->getChannel()->value,
                'by' => self::person($step->getActor()),
                'at' => self::at($step->getOccurredAt()),
            ]),
        ];
    }

    /** @return array<string, mixed> */
    public static function invitation(Invitation $invitation, DateTimeImmutable $now): array
    {
        $role = $invitation->getRole();

        return [
            'id' => $invitation->getId()->toRfc4122(),
            'email' => $invitation->getEmail(),
            'role' => null === $role ? null : self::role($role),
            'invitedBy' => self::person($invitation->getInvitedBy()),
            'status' => $invitation->getStatusAt($now)->value,
            'sentAt' => self::at($invitation->getSentAt() ?? $invitation->getCreatedAt()),
            'expiresAt' => self::at($invitation->getExpiresAt()),
            'acceptedAt' => self::at($invitation->getAcceptedAt()),
            'declinedAt' => self::at($invitation->getDeclinedAt()),
            'revokedAt' => self::at($invitation->getRevokedAt()),
        ];
    }

    /** @return array{id: string, seededAs: ?string, name: ?string} a seeded role is named by its key, which each client words */
    public static function role(Role $role): array
    {
        return [
            'id' => $role->getId()->toRfc4122(),
            'seededAs' => $role->getSeededAs()?->value,
            'name' => $role->getName(),
        ];
    }

    /** Approval and Restore move a member already inside, in Settings, and are not how they came. */
    private static function fromOutside(MembershipTransition $step): bool
    {
        $from = $step->getFromStatus();

        return null === $from || MembershipStatus::LeftOrRemoved === $from;
    }

    // The machine has one state for both; who caused it tells them apart.
    private static function former(?MembershipTransition $last, User $member): ?string
    {
        if (null === $last) {
            return null;
        }

        return true === $last->getActor()?->getId()->equals($member->getId()) ? 'left' : 'removed';
    }

    /** @return array{id: string, name: string}|null */
    private static function person(?User $user): ?array
    {
        return null === $user ? null : ['id' => $user->getId()->toRfc4122(), 'name' => $user->getName()];
    }

    private static function at(?DateTimeInterface $at): ?string
    {
        return $at?->format(DateTimeInterface::ATOM);
    }
}
