<?php

declare(strict_types=1);

namespace App\Domain\User\Device;

use App\Http\RefreshTokenCookies;
use DateTimeImmutable;
use Psl\Regex;
use Psl\SecureRandom;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/** The identifier a client keeps (sc-511): the app's install identifier, or the web's cookie. Never the user agent. */
final class DeviceIdentity
{
    public const string HEADER = 'X-Device-Id';

    public const string COOKIE = 'soirely_device';

    /** Where a request that needs the cookie set keeps the identifier until its response goes out. */
    private const string ATTRIBUTE = '_soirely_device_cookie';

    /** RFC 6265bis caps a cookie's lifetime at 400 days; each sign-in starts it again. */
    private const int COOKIE_DAYS = 400;

    private const int NEW_BYTES = 32;

    /** The identifier the request carries, or a new one that the response then sets as the cookie. */
    public static function of(Request $request): string
    {
        $sent = self::wellFormed($request->headers->get(self::HEADER));

        if (null !== $sent) {
            return $sent;
        }

        $id = self::wellFormed($request->cookies->getString(self::COOKIE))
            ?? \bin2hex(SecureRandom\bytes(self::NEW_BYTES));
        $request->attributes->set(self::ATTRIBUTE, $id);

        return $id;
    }

    /** Only a request that asked for its identifier gets the cookie. */
    public static function attachTo(Response $response, Request $request): void
    {
        $id = $request->attributes->get(self::ATTRIBUTE);

        if (!\is_string($id)) {
            return;
        }

        $response->headers->setCookie(Cookie::create(
            name: self::COOKIE,
            value: $id,
            expire: new DateTimeImmutable('+' . self::COOKIE_DAYS . ' days'),
            path: RefreshTokenCookies::PATH,
            secure: RefreshTokenCookies::isSecure($request),
            httpOnly: true,
            sameSite: Cookie::SAMESITE_STRICT,
        ));
    }

    private static function wellFormed(?string $id): ?string
    {
        return null !== $id && Regex\matches($id, '/^[A-Za-z0-9_-]{16,128}$/') ? $id : null;
    }
}
