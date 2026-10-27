<?php

declare(strict_types=1);

namespace App\Domain\Event\Model;

use App\Enum\EventAction;
use App\Enum\EventGuard;
use App\Enum\EventStatus;
use Psl\Iter;

/** One row of /event-states.json's `transitions`: an action that moves an event from one stored state to another, once its guards pass. */
final readonly class EventTransition
{
    /** @param list<EventGuard> $guards */
    public function __construct(
        public EventStatus $from,
        public EventAction $action,
        public EventStatus $to,
        public array $guards,
    ) {
    }

    /** @return list<self> */
    public static function all(): array
    {
        return [
            new self(EventStatus::Draft, EventAction::MakeLive, EventStatus::Live, [EventGuard::EndNotPassed, EventGuard::HasHost, EventGuard::PlanLimit]),
            new self(EventStatus::Live, EventAction::End, EventStatus::Ended, [EventGuard::EndNotPassed]),
            new self(EventStatus::Paused, EventAction::End, EventStatus::Ended, [EventGuard::EndNotPassed]),
        ];
    }

    /** Null when no row leaves `$from` by `$action`, which the API refuses `event_state_invalid`. */
    public static function of(EventStatus $from, EventAction $action): ?self
    {
        return Iter\search(self::all(), static fn (self $row): bool => $row->from === $from && $row->action === $action);
    }
}
