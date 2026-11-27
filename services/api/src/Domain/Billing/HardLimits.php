<?php

declare(strict_types=1);

namespace App\Domain\Billing;

use App\Domain\Billing\Catalogue\Model\Allowance;
use App\Domain\Billing\Interfaces\HardLimitsInterface;
use App\Entity\Event;
use App\Entity\Organisation;
use App\Enum\CatalogueLimit;
use App\Enum\ErrorCode;
use App\Enum\Plan;
use App\Http\Exception\ApiException;
use App\Repository\EventRepository;
use App\Repository\GuestRepository;
use App\Repository\InvitationRepository;
use App\Repository\MembershipRepository;
use DateTimeInterface;
use DateTimeZone;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Counts what each limit counts, against the organisation's entitlement (sc-3927, sc-3928); the ceiling is the one number no plan sets. */
final readonly class HardLimits implements HardLimitsInterface
{
    public const int EVENT_CAPACITY = 10_000;

    public function __construct(
        private Entitlements $entitlements,
        private EventRepository $eventRepository,
        private GuestRepository $guestRepository,
        private MembershipRepository $membershipRepository,
        private InvitationRepository $invitationRepository,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    public function requireLiveRoom(Organisation $organisation): void
    {
        [$plan, $allowance] = $this->allowance($organisation, CatalogueLimit::LiveEvents);

        if ($allowance->isUnlimited()) {
            return;
        }

        $this->entityManager->lock($organisation, LockMode::PESSIMISTIC_WRITE);
        $now = $this->clock->now();
        $used = $this->eventRepository->countActiveIn($organisation, $now);

        if ($allowance->covers($used + 1)) {
            return;
        }

        $first = $this->eventRepository->findFirstToCloseIn($organisation, $now);

        throw $this->reached(CatalogueLimit::LiveEvents, $plan, $used, $allowance, 'event.plan_limit', [
            'event' => null === $first ? null : [
                'id' => $first->getId()->toRfc4122(),
                'name' => $first->getName(),
                'endsAt' => $first->getEndsAt()->setTimezone(new DateTimeZone($first->getTimeZone()))->format(DateTimeInterface::ATOM),
                'timeZone' => $first->getTimeZone(),
            ],
        ]);
    }

    public function requirePeopleRoom(Event $event, int $adding): void
    {
        if ($adding <= 0) {
            return;
        }

        $this->requireRoom($event->getOrganisation(), $this->guestRepository->countPeople($event), $adding, 'guest.capacity_reached', 'guest.plan_limit');
    }

    public function requireRoomForCopy(Organisation $organisation, int $people): void
    {
        if ($people <= 0) {
            return;
        }

        $this->requireRoom($organisation, 0, $people, 'event.copy_capacity_reached', 'event.copy_plan_limit');
    }

    public function requireSeatToInvite(Organisation $organisation): void
    {
        $this->requireSeatToAdd($organisation, 'members.plan_limit_seats');
    }

    public function requireSeatToApprove(Organisation $organisation): void
    {
        $this->requireSeatToAdd($organisation, 'members.approve_plan_limit_seats');
    }

    public function requireSeatToAccept(Organisation $organisation): void
    {
        [$plan, $allowance] = $this->allowance($organisation, CatalogueLimit::TeamSeats);

        if ($allowance->isUnlimited()) {
            return;
        }

        $used = $this->seatsTaken($organisation);

        if ($allowance->covers($used)) {
            return;
        }

        throw new ApiException(
            ErrorCode::PlanLimitReached,
            $this->translator->trans('invitations.seats_in_use', ['organisation' => $organisation->getName()]),
            members: [...self::members(CatalogueLimit::TeamSeats, $plan, $used, $allowance), 'organisation' => $organisation->getName()],
        );
    }

    /** The ceiling first: no plan lifts it, so offering Change plan for it would lift nothing. */
    private function requireRoom(Organisation $organisation, int $people, int $adding, string $overCeiling, string $overPlan): void
    {
        if ($people + $adding > self::EVENT_CAPACITY) {
            throw new ApiException(
                ErrorCode::EventCapacityReached,
                $this->translator->trans($overCeiling, ['ceiling' => self::EVENT_CAPACITY, 'count' => $adding]),
                members: ['ceiling' => self::EVENT_CAPACITY, 'onEvent' => $people, 'adding' => $adding],
            );
        }

        [$plan, $allowance] = $this->allowance($organisation, CatalogueLimit::GuestsPerEvent);

        if ($allowance->covers($people + $adding)) {
            return;
        }

        throw $this->reached(CatalogueLimit::GuestsPerEvent, $plan, $people, $allowance, $overPlan, ['adding' => $adding]);
    }

    private function requireSeatToAdd(Organisation $organisation, string $key): void
    {
        [$plan, $allowance] = $this->allowance($organisation, CatalogueLimit::TeamSeats);

        if ($allowance->isUnlimited()) {
            return;
        }

        $used = $this->seatsTaken($organisation);

        if ($allowance->covers($used + 1)) {
            return;
        }

        throw $this->reached(CatalogueLimit::TeamSeats, $plan, $used, $allowance, $key);
    }

    /** Taken under a lock on the organisation, held to the end of the caller's transaction. */
    private function seatsTaken(Organisation $organisation): int
    {
        $this->entityManager->lock($organisation, LockMode::PESSIMISTIC_WRITE);

        return $this->membershipRepository->countActiveIn($organisation) + $this->invitationRepository->countPendingIn($organisation, $this->clock->now());
    }

    /** @return array{Plan, Allowance} */
    private function allowance(Organisation $organisation, CatalogueLimit $limit): array
    {
        $entitlement = $this->entitlements->of($organisation->getId());

        return [$entitlement->plan, $entitlement->terms->limit($limit)->allowance];
    }

    /** @param array<string, mixed> $extra */
    private function reached(CatalogueLimit $limit, Plan $plan, int $used, Allowance $allowance, string $key, array $extra = []): ApiException
    {
        return new ApiException(
            ErrorCode::PlanLimitReached,
            $this->translator->trans($key, ['plan' => Str\capitalize($plan->value), 'limit' => $allowance->amount ?? 0, 'count' => $extra['adding'] ?? $used]),
            members: [...self::members($limit, $plan, $used, $allowance), ...$extra],
        );
    }

    /** @return array{limit: string, plan: string, used: int, allowed: int} */
    private static function members(CatalogueLimit $limit, Plan $plan, int $used, Allowance $allowance): array
    {
        return ['limit' => $limit->value, 'plan' => $plan->value, 'used' => $used, 'allowed' => $allowance->amount ?? 0];
    }
}
