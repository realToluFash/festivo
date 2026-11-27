<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Sms;

use DateTimeImmutable;
use DateTimeZone;

/** A text goes only from 09:00 to 20:00 in the recipient's time (sc-3946, 47 CFR 64.1200(c)(1)); this is not the push's quiet hours, which are the member's night. */
final class SmsQuietHours
{
    public const int OPENS = 9;

    public const int CLOSES = 20;

    /** @return ?DateTimeImmutable the 09:00 a text due now waits for, or null when it goes now */
    public static function releaseAt(DateTimeImmutable $now, DateTimeZone $zone): ?DateTimeImmutable
    {
        $local = $now->setTimezone($zone);
        $hour = (int) $local->format('G');

        if ($hour >= self::OPENS && $hour < self::CLOSES) {
            return null;
        }

        return ($hour >= self::CLOSES ? $local->modify('+1 day') : $local)->setTime(self::OPENS, 0)->setTimezone(new DateTimeZone('UTC'));
    }
}
