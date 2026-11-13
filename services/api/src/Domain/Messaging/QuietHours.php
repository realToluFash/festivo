<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Enum\NotificationCategory;
use DateTimeImmutable;
use DateTimeZone;

/** Epic 36 §5: between these hours in the member's own zone, only Event day pushes come through. The clients' footer reads the same two from /quiet-hours.json. */
final class QuietHours
{
    public const int START = 21;

    public const int END = 8;

    /** @return ?DateTimeImmutable the morning a push due now waits for, or null when it goes now */
    public static function releaseAt(NotificationCategory $category, DateTimeImmutable $now, ?string $zone): ?DateTimeImmutable
    {
        if (NotificationCategory::EventDay === $category) {
            return null;
        }

        $local = $now->setTimezone(new DateTimeZone($zone ?? 'UTC'));
        $hour = (int) $local->format('G');

        if ($hour >= self::END && $hour < self::START) {
            return null;
        }

        return ($hour >= self::START ? $local->modify('+1 day') : $local)->setTime(self::END, 0)->setTimezone(new DateTimeZone('UTC'));
    }
}
