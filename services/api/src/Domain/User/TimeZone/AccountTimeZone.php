<?php

declare(strict_types=1);

namespace App\Domain\User\TimeZone;

use App\Entity\User;
use DateTimeZone;
use IntlTimeZone;
use Psl\Iter;
use Symfony\Component\HttpFoundation\Request;

/** The account's IANA zone: what a device says it is in, never a guess (sc-868). */
final class AccountTimeZone
{
    /** Each client sends its device's zone on every request, as it sends its language. */
    public const string HEADER = 'X-Timezone';

    /** The one zone check, account's or organisation's: the current IANA name (Chrome sends Asia/Calcutta), else null. */
    public static function canonical(string $zone): ?string
    {
        $listed = DateTimeZone::listIdentifiers();

        if (Iter\contains($listed, $zone)) {
            return $zone;
        }

        $iana = '' === $zone ? false : IntlTimeZone::getIanaID($zone);

        return \is_string($iana) && Iter\contains($listed, $iana) ? $iana : null;
    }

    /** The zone the request named, by its current name, when it is a real one; null otherwise. */
    public static function askedIn(?Request $request): ?string
    {
        $zone = $request?->headers->get(self::HEADER);

        return null === $zone ? null : self::canonical($zone);
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
