<?php

declare(strict_types=1);

namespace App\Enum;

use DateTimeImmutable;
use Psl\Iter;

/** An event's state as the clock makes it, never stored: a Live event is Happening now from its start, and a Live or Paused one Finished from its end. */
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
            EventStatus::Paused => $now >= $endsAt ? self::Finished : self::Paused,
            EventStatus::Ended => self::Finished,
            EventStatus::Live => match (true) {
                $now >= $endsAt => self::Finished,
                $now >= $startsAt => self::HappeningNow,
                default => self::Live,
            },
        };
    }

    /** Ended before it started: called off (sc-3585), so it never took place. */
    public static function calledOff(?DateTimeImmutable $endedAt, DateTimeImmutable $startsAt): bool
    {
        return null !== $endedAt && $endedAt < $startsAt;
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
            self::Paused => [EventAction::Edit, EventAction::EditSchedule, EventAction::Resume, EventAction::End, EventAction::Delete, EventAction::CheckIn, EventAction::Service],
            self::Finished => [EventAction::Edit, EventAction::Delete],
        };
    }

    public function allows(EventAction $action): bool
    {
        return Iter\contains($this->allowed(), $action);
    }
}
