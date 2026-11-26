<?php

declare(strict_types=1);

namespace App\Domain\Organisation;

use App\Domain\Billing\Entitlements;
use App\Domain\Organisation\SignInRules\SignInRules;
use App\Domain\Staff\Link\OutsideEvent;
use App\Domain\Staff\Link\StaffLinkGrants;
use App\Entity\Membership;
use App\Entity\User;
use App\Enum\PlanFeature;
use App\Enum\SeededRole;
use App\Http\Access\EventScope;
use App\Http\Access\Grants;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Repository\EventPersonRepository;
use App\Repository\MembershipRepository;
use Psl\Iter;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

final readonly class MembershipDirectory implements MembershipDirectoryInterface
{
    public function __construct(
        private MembershipRepository $membershipRepository,
        private EventPersonRepository $eventPersonRepository,
        private SignInRules $signInRules,
        private ClockInterface $clock,
        private Entitlements $entitlements,
        private StaffLinkGrants $staffLinkGrants,
    ) {
    }

    /** The role's permissions, narrowed by the organisation's sign-in rules (sc-69, sc-609). */
    public function grantsIn(User $user, Uuid $organisationId): ?Grants
    {
        $membership = $this->membershipRepository->findActive($user, $organisationId);

        return null === $membership ? null : $this->signInRules->narrow($this->grantsOf($membership), $membership);
    }

    /** Read on every request, so a change applies on the next one. A member reaches the event through the membership alone, never a grant from outside (sc-71) or a staff link (sc-4235). */
    public function grantsOnEvent(User $user, Uuid $organisationId, Uuid $eventId): ?Grants
    {
        $membership = $this->membershipRepository->findActive($user, $organisationId);

        if (null === $membership) {
            $outside = $this->eventPersonRepository->findLiveOutside($eventId, $user, $this->clock->now());
            $role = $outside?->getRole() ?? $this->staffLinkGrants->onEvent($user, $eventId);

            return null === $role ? null : Grants::fromOutside($role);
        }

        if (SeededRole::Member !== $membership->getRole()->getSeededAs()) {
            return $this->signInRules->narrow($this->grantsOf($membership), $membership);
        }

        $person = $this->eventPersonRepository->findOneOn($eventId, $membership);

        return null === $person ? null : $this->signInRules->narrow(Grants::onEvent($person->getRole())->onPlan($this->planOf($membership)), $membership);
    }

    /** Null unless an active member; for a Member, their roles on events in one query rather than one per event. */
    public function eventScopeIn(User $user, Uuid $organisationId): ?EventScope
    {
        $membership = $this->membershipRepository->findActive($user, $organisationId);

        if (null === $membership) {
            return null;
        }

        $grants = $this->signInRules->narrow($this->grantsOf($membership), $membership);

        if (SeededRole::Member !== $membership->getRole()->getSeededAs()) {
            return new EventScope(null, $grants);
        }

        $byEvent = [];
        $plan = $this->planOf($membership);

        foreach ($this->eventPersonRepository->findFor($membership) as $person) {
            $byEvent[$person->getEvent()->getId()->toRfc4122()] = $this->signInRules->narrow(Grants::onEvent($person->getRole())->onPlan($plan), $membership);
        }

        return new EventScope($membership, $grants, $byEvent);
    }

    public function isOutsideIn(User $user, Uuid $organisationId): bool
    {
        if (null !== $this->membershipRepository->findActive($user, $organisationId)) {
            return false;
        }

        return Iter\any($this->staffLinkGrants->liveOutsideEvents($user), static fn (OutsideEvent $outside): bool => $outside->event->getOrganisation()->getId()->equals($organisationId));
    }

    /** @return list<PlanFeature> */
    private function planOf(Membership $membership): array
    {
        return $this->entitlements->of($membership->getOrganisation()->getId())->terms->features();
    }

    private function grantsOf(Membership $membership): Grants
    {
        $role = $membership->getRole();

        return ($role->isOwner() ? Grants::everything() : Grants::only($role->getPermissions()))->onPlan($this->planOf($membership));
    }
}
