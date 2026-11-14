<?php

declare(strict_types=1);

namespace App\Enum;

use DateTimeImmutable;

/** What a guest's own page says of its event (sc-3591): Paused, Called off and Finished each close answers with a notice; a Draft never reaches the page. */
enum GuestPagePhase: string
{
    case Live = 'live';
    case Paused = 'paused';
    case CalledOff = 'calledOff';
    case Finished = 'finished';

    public static function of(EventStatus $status, DateTimeImmutable $startsAt, DateTimeImmutable $endsAt, ?DateTimeImmutable $endedAt, DateTimeImmutable $now): self
    {
        if (EventPhase::calledOff($endedAt, $startsAt)) {
            return self::CalledOff;
        }

        return match (EventPhase::of($status, $startsAt, $endsAt, $now)) {
            EventPhase::Draft, EventPhase::Live, EventPhase::HappeningNow => self::Live,
            EventPhase::Paused => self::Paused,
            EventPhase::Finished => self::Finished,
        };
    }

    /** The problem a reply sent on this phase is refused with; null while answers can still be taken. */
    public function refusal(): ?ErrorCode
    {
        return match ($this) {
            self::Live => null,
            self::Paused => ErrorCode::EventPaused,
            self::CalledOff, self::Finished => ErrorCode::EventConcluded,
        };
    }
}
