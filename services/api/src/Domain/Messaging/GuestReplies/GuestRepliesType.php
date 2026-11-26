<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestReplies;

use App\Domain\Messaging\Interfaces\NotificationTypeInterface;
use App\Domain\Messaging\Model\EventTimes;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\NotificationEventRule;
use DateTimeImmutable;
use Psl\Type;

/** What the three Guest replies types share: the category, its member audience, and the event the payload names. */
abstract readonly class GuestRepliesType implements NotificationTypeInterface
{
    public function audienceKind(): NotificationAudienceKind
    {
        return NotificationAudienceKind::Member;
    }

    public function category(): NotificationCategory
    {
        return NotificationCategory::GuestReplies;
    }

    public function eventRule(): NotificationEventRule
    {
        return NotificationEventRule::Automatic;
    }

    public function canBeSwitchedOff(): bool
    {
        return true;
    }

    public function tooLateAt(DateTimeImmutable $dueAt, ?EventTimes $event): ?DateTimeImmutable
    {
        return null;
    }

    public function carriesCode(): bool
    {
        return false;
    }

    public function supersedesEarlier(): bool
    {
        return false;
    }

    public function reachesSuppressed(): bool
    {
        return false;
    }

    /** @param array<string, mixed> $payload */
    protected static function eventId(array $payload): string
    {
        return Type\string()->coerce($payload['eventId'] ?? '');
    }
}
