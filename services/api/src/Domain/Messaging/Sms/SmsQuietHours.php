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

    /**
     * @param non-empty-list<DateTimeZone> $zones every zone the recipient may be in, less than the window's length apart
     *
     * @return ?DateTimeImmutable when a text due now is first inside the window in all of them, or null when it goes now
     */
    public static function releaseAt(DateTimeImmutable $now, array $zones): ?DateTimeImmutable
    {
        $release = $now;

        do {
            $waited = false;

            foreach ($zones as $zone) {
                $opening = self::nextOpening($release, $zone);
                $release = $opening ?? $release;
                $waited = $waited || null !== $opening;
            }
        } while ($waited);

        return $release === $now ? null : $release;
    }

    private static function nextOpening(DateTimeImmutable $now, DateTimeZone $zone): ?DateTimeImmutable
    {
        $local = $now->setTimezone($zone);
        $hour = (int) $local->format('G');

        if ($hour >= self::OPENS && $hour < self::CLOSES) {
            return null;
        }

        return ($hour >= self::CLOSES ? $local->modify('+1 day') : $local)->setTime(self::OPENS, 0)->setTimezone(new DateTimeZone('UTC'));
    }
}
