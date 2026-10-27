<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Audit\Auditor;
use App\Domain\Event\Interfaces\ActiveEventsLimitInterface;
use App\Domain\Event\Model\EventTransition;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\EventAction;
use App\Enum\EventGuard;
use App\Enum\EventPhase;
use App\Http\Exception\ApiException;
use Closure;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Moves an event between its stored states by /event-states.json's `transitions`, each move in the audit log (sc-3584). */
final readonly class EventLifecycle
{
    public const string MADE_LIVE = 'event.made_live';

    public const string ENDED = 'event.ended';

    public const string PAUSED = 'event.paused';

    public const string RESUMED = 'event.resumed';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private ActiveEventsLimitInterface $activeEventsLimit,
        private Auditor $auditor,
        private ClockInterface $clock,
        private TranslatorInterface $translator,
    ) {
    }

    public function makeLive(Event $event, User $by): Event
    {
        return $this->move($event, EventAction::MakeLive, self::MADE_LIVE, $by, static fn (Event $event, DateTimeImmutable $now) => $event->makeLive($now));
    }

    /** Before the start this calls the event off, and after it ends it early: one action, refused once the end has passed (sc-3585). */
    public function end(Event $event, User $by): Event
    {
        return $this->move($event, EventAction::End, self::ENDED, $by, static fn (Event $event, DateTimeImmutable $now) => $event->end($now));
    }

    /** Refused while it is Finished, as Resume is: a pause stops guests and keeps everything (sc-3586). */
    public function pause(Event $event, User $by): Event
    {
        return $this->move($event, EventAction::Pause, self::PAUSED, $by, static fn (Event $event, DateTimeImmutable $now) => $event->pause($now));
    }

    /** Never checks the plan's limit: a Paused event already counts toward it (sc-3586, "Decided, 21 Oct"). */
    public function resume(Event $event, User $by): Event
    {
        return $this->move($event, EventAction::Resume, self::RESUMED, $by, static fn (Event $event) => $event->resume());
    }

    /** @param Closure(Event, DateTimeImmutable): void $apply */
    private function move(Event $event, EventAction $action, string $audited, User $by, Closure $apply): Event
    {
        return $this->entityManager->wrapInTransaction(function () use ($event, $action, $audited, $by, $apply): Event {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $before = $event->getStatus();
            $now = $this->clock->now();
            $transition = EventTransition::of($before, $action) ?? throw $this->stateInvalid($event, $now);

            foreach ($transition->guards as $guard) {
                $this->check($guard, $action, $event, $now);
            }

            $apply($event, $now);
            $this->auditor->record($audited, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), [
                'status' => [$before->value, $transition->to->value],
            ]);
            $this->entityManager->flush();

            return $event;
        });
    }

    private function check(EventGuard $guard, EventAction $action, Event $event, DateTimeImmutable $now): void
    {
        match ($guard) {
            EventGuard::EndNotPassed => $now < $event->getEndsAt()
                ? null
                : throw new ApiException(ErrorCode::EventConcluded, $this->translator->trans(EventAction::End === $action ? 'event.already_over' : 'event.concluded')),
            EventGuard::HasHost => [] !== $event->getHosts()
                ? null
                : throw new ApiException(ErrorCode::EventHostRequired, $this->translator->trans('event.host_required')),
            EventGuard::PhaseAllows => $this->phaseOf($event, $now)->allows($action) ? null : throw $this->stateInvalid($event, $now),
            EventGuard::PlanLimit => null === ($limit = $this->activeEventsLimit->reachedBy($event->getOrganisation()))
                ? null
                : throw new ApiException(
                    ErrorCode::PlanLimit,
                    $this->translator->trans('event.plan_limit', ['plan' => $limit->plan, 'limit' => $limit->limit]),
                    members: ['plan' => $limit->plan, 'limit' => $limit->limit],
                ),
        };
    }

    private function stateInvalid(Event $event, DateTimeImmutable $now): ApiException
    {
        return new ApiException(ErrorCode::EventStateInvalid, $this->translator->trans('event.state_invalid'), members: ['phase' => $this->phaseOf($event, $now)->value]);
    }

    private function phaseOf(Event $event, DateTimeImmutable $now): EventPhase
    {
        return EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $now);
    }
}
