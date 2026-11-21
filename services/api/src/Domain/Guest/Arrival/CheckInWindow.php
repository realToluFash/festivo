<?php

declare(strict_types=1);

namespace App\Domain\Guest\Arrival;

use App\Entity\Event;
use App\Enum\CheckInState;
use App\Enum\EventAction;
use App\Enum\EventPhase;
use DateTimeImmutable;

/** The door opens 120 minutes before the start, in the event's timezone, and closes when the event is concluded (sc-1454, Decided 17 Oct). */
final class CheckInWindow
{
    public const int OPENS_MINUTES_BEFORE = 120;

    public static function opensAt(Event $event): DateTimeImmutable
    {
        return $event->getStartsAt()->modify('-' . self::OPENS_MINUTES_BEFORE . ' minutes');
    }

    public static function stateOf(Event $event, DateTimeImmutable $now): CheckInState
    {
        $phase = EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $now);

        return match (true) {
            EventPhase::Finished === $phase => CheckInState::Ended,
            $now < self::opensAt($event) || !$phase->allows(EventAction::CheckIn) => CheckInState::BeforeOpen,
            default => CheckInState::Open,
        };
    }
}
