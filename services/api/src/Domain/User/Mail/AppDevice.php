<?php

declare(strict_types=1);

namespace App\Domain\User\Mail;

use Psl\Regex;
use Psl\Str;

/** The device class in the app's own user agent, read as `appDevice()` in packages/domain reads it (sc-1242). */
enum AppDevice: string
{
    case IPhone = 'iPhone';
    case IPad = 'iPad';
    case Phone = 'phone';
    case Tablet = 'tablet';

    /** The whole string or nothing: a `Soirely/` agent with any other device token is shown as it came. */
    private const string FORMAT = '/^Soirely\/[^\s()]+ \([^;()]+ [^;()\s]+; (iPhone|iPad|phone|tablet)\)$/';

    public static function of(?string $userAgent): ?self
    {
        $found = Regex\first_match(Str\trim($userAgent ?? ''), self::FORMAT);

        return null === $found ? null : self::from($found[1]);
    }
}
