<?php

declare(strict_types=1);

namespace App\Domain\Organisation;

use App\Domain\Organisation\SignInRules\SignInRules;
use App\Entity\Membership;
use App\Entity\User;
use App\Enum\SeededRole;
use App\Http\Access\EventScope;
use App\Http\Access\Grants;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Repository\EventPersonRepository;
use App\Repository\MembershipRepository;
use Symfony\Component\Uid\Uuid;

final readonly class MembershipDirectory implements MembershipDirectoryInterface
{
    public function __construct(
        private MembershipRepository $membershipRepository,
        private EventPersonRepository $eventPersonRepository,
        private SignInRules $signInRules,
    ) {
    }

    /** The role's permissions, narrowed by the organisation's sign-in rules (sc-69, sc-609). */
    public function grantsIn(User $user, Uuid $organisationId): ?Grants
    {
        $membership = $this->membershipRepository->findActive($user, $organisationId);

        return null === $membership ? null : $this->signInRules->narrow(self::grantsOf($membership), $membership);
    }

    /** Read on every request, so a change to somebody's role on the event applies on their next one. */
    public function grantsOnEvent(User $user, Uuid $organisationId, Uuid $eventId): ?Grants
    {
        $membership = $this->membershipRepository->findActive($user, $organisationId);

        if (null === $membership) {
            return null;
        }

        if (SeededRole::Member !== $membership->getRole()->getSeededAs()) {
            return $this->signInRules->narrow(self::grantsOf($membership), $membership);
        }

        $person = $this->eventPersonRepository->findOneOn($eventId, $membership);

        return null === $person ? null : $this->signInRules->narrow(Grants::only($person->getRole()->permissions()), $membership);
    }

    /** Null unless an active member; for a Member, their roles on events in one query rather than one per event. */
    public function eventScopeIn(User $user, Uuid $organisationId): ?EventScope
    {
        $membership = $this->membershipRepository->findActive($user, $organisationId);

        if (null === $membership) {
            return null;
        }

        $grants = $this->signInRules->narrow(self::grantsOf($membership), $membership);

        if (SeededRole::Member !== $membership->getRole()->getSeededAs()) {
            return new EventScope(null, $grants);
        }

        $byEvent = [];

        foreach ($this->eventPersonRepository->findFor($membership) as $person) {
            $byEvent[$person->getEvent()->getId()->toRfc4122()] = $this->signInRules->narrow(Grants::only($person->getRole()->permissions()), $membership);
        }

        return new EventScope($membership, $grants, $byEvent);
    }

    private static function grantsOf(Membership $membership): Grants
    {
        $role = $membership->getRole();

        return $role->isOwner() ? Grants::everything() : Grants::only($role->getPermissions());
    }
}
