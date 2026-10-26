<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Domain\Messaging\Model\EventState;
use App\Domain\Messaging\Model\EventVerdict;
use App\Enum\EventPhase;
use App\Enum\NotificationEventRule;
use DateInterval;
use DateTimeImmutable;

/** Whether a type may go for an event as it is now (sc-104, epic 36 §9). An event whose organisation is deleted arrives here deleted. */
final readonly class EventGate
{
    public const string HOST_MESSAGES_AFTER_END = 'P30D';

    public static function verdict(NotificationEventRule $rule, ?EventState $event, DateTimeImmutable $now): EventVerdict
    {
        if (null === $event) {
            return NotificationEventRule::DeletionNotice === $rule ? EventVerdict::Send : EventVerdict::Cancel;
        }

        if ($event->deleted) {
            return NotificationEventRule::DeletionNotice === $rule ? EventVerdict::Send : EventVerdict::Cancel;
        }

        return match (EventPhase::of($event->status, $event->startsAt, $event->endsAt, $now)) {
            EventPhase::Draft, EventPhase::Live, EventPhase::HappeningNow => EventVerdict::Send,
            EventPhase::Paused => match ($rule) {
                NotificationEventRule::Automatic, NotificationEventRule::AfterConclusion => EventVerdict::Hold,
                default => EventVerdict::Send,
            },
            EventPhase::Finished => match ($rule) {
                NotificationEventRule::Automatic => EventVerdict::Cancel,
                NotificationEventRule::HostMessage => $now < ($event->endedAt ?? $event->endsAt)->add(new DateInterval(self::HOST_MESSAGES_AFTER_END))
                    ? EventVerdict::Send
                    : EventVerdict::Cancel,
                default => EventVerdict::Send,
            },
        };
    }
}
