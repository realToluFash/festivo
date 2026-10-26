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
use App\Http\Exception\ApiException;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Moves an event between its stored states by /event-states.json's `transitions`, each move in the audit log (sc-3584). */
final readonly class EventLifecycle
{
    public const string MADE_LIVE = 'event.made_live';

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
        return $this->entityManager->wrapInTransaction(function () use ($event, $by): Event {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $before = $event->getStatus();
            $transition = EventTransition::of($before, EventAction::MakeLive)
                ?? throw new ApiException(ErrorCode::EventStateInvalid, $this->translator->trans('event.state_invalid'), members: ['status' => $before->value]);
            $now = $this->clock->now();

            foreach ($transition->guards as $guard) {
                $this->check($guard, $event, $now);
            }

            $event->makeLive($now);
            $this->auditor->record(self::MADE_LIVE, 'Event', $event->getId(), Actor::User, $by->getId(), $by->getName(), [
                'status' => [$before->value, $transition->to->value],
            ]);
            $this->entityManager->flush();

            return $event;
        });
    }

    private function check(EventGuard $guard, Event $event, DateTimeImmutable $now): void
    {
        match ($guard) {
            EventGuard::EndNotPassed => $now < $event->getEndsAt()
                ? null
                : throw new ApiException(ErrorCode::EventConcluded, $this->translator->trans('event.concluded')),
            EventGuard::PlanLimit => null === ($limit = $this->activeEventsLimit->reachedBy($event->getOrganisation()))
                ? null
                : throw new ApiException(
                    ErrorCode::PlanLimit,
                    $this->translator->trans('event.plan_limit', ['plan' => $limit->plan, 'limit' => $limit->limit]),
                    members: ['plan' => $limit->plan, 'limit' => $limit->limit],
                ),
        };
    }
}
