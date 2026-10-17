<?php

declare(strict_types=1);

namespace App\Domain\User\TimeZone;

use App\Entity\User;
use DateTimeZone;
use Psl\Iter;
use Symfony\Component\HttpFoundation\Request;

/** The account's IANA zone: what a device says it is in, never a guess (sc-868). */
final class AccountTimeZone
{
    /** Each client sends its device's zone on every request, as it sends its language. */
    public const string HEADER = 'X-Timezone';

    public static function isKnown(string $zone): bool
    {
        return Iter\contains(DateTimeZone::listIdentifiers(), $zone);
    }

    /** The zone the request named, when it is a real one; null otherwise. */
    public static function askedIn(?Request $request): ?string
    {
        $zone = $request?->headers->get(self::HEADER);

        return null !== $zone && self::isKnown($zone) ? $zone : null;
    }

    /** @return bool whether it was set, so the caller knows to flush */
    public static function rememberIfNone(User $user, ?Request $request): bool
    {
        $zone = self::askedIn($request);

        if (null !== $user->getTimezone() || null === $zone) {
            return false;
        }

        $user->setTimezone($zone);

        return true;
    }
}
