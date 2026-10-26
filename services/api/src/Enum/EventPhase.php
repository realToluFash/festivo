<?php

declare(strict_types=1);

namespace App\Enum;

use DateTimeImmutable;
use Psl\Iter;

/** An event's state as the clock makes it, never stored: a Live event is Happening now from its start and Finished from its end. */
enum EventPhase: string
{
    case Draft = 'draft';
    case Live = 'live';
    case HappeningNow = 'happening_now';
    case Paused = 'paused';
    case Finished = 'finished';

    public static function of(EventStatus $status, DateTimeImmutable $startsAt, DateTimeImmutable $endsAt, DateTimeImmutable $now): self
    {
        return match ($status) {
            EventStatus::Draft => self::Draft,
            EventStatus::Paused => self::Paused,
            EventStatus::Ended => self::Finished,
            EventStatus::Live => match (true) {
                $now >= $endsAt => self::Finished,
                $now >= $startsAt => self::HappeningNow,
                default => self::Live,
            },
        };
    }

    /** @return list<EventAction> */
    public function allowed(): array
    {
        return match ($this) {
            self::Draft => [EventAction::Edit, EventAction::EditSchedule, EventAction::Delete, EventAction::MakeLive],
            self::Live, self::HappeningNow => [
                EventAction::Edit,
                EventAction::EditSchedule,
                EventAction::Pause,
                EventAction::End,
                EventAction::Delete,
                EventAction::Invite,
                EventAction::Message,
                EventAction::CheckIn,
                EventAction::Service,
            ],
            self::Paused => [],
            self::Finished => [EventAction::Edit, EventAction::EditSchedule, EventAction::Delete],
        };
    }

    public function allows(EventAction $action): bool
    {
        return Iter\contains($this->allowed(), $action);
    }
}
