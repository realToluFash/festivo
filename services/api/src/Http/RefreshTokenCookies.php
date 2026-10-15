<?php

declare(strict_types=1);

namespace App\Http;

use DateTimeImmutable;
use Psl\Iter;
use SensitiveParameter;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

final readonly class RefreshTokenCookies
{
    public const string NAME = 'soirely_refresh';

    /**
     * Scoped to the routes that read it, so the browser does not attach it to
     * every other request. A cookie that rides along everywhere is a cookie any
     * endpoint could be talked into acting on.
     */
    private const string PATH = '/api/auth';

    public static function attachTo(
        Response $response,
        #[SensitiveParameter]
        string $plain,
        DateTimeImmutable $expiresAt,
        Request $request,
    ): void {
        $response->headers->setCookie(Cookie::create(
            name: self::NAME,
            value: $plain,
            expire: $expiresAt,
            path: self::PATH,
            secure: self::isSecure($request),
            httpOnly: true,
            sameSite: Cookie::SAMESITE_STRICT,
        ));
    }

    public static function readFrom(Request $request): ?string
    {
        $value = $request->cookies->getString(self::NAME);

        return '' === $value ? null : $value;
    }

    public static function clearOn(Response $response, Request $request): void
    {
        $response->headers->clearCookie(
            name: self::NAME,
            path: self::PATH,
            secure: self::isSecure($request),
            httpOnly: true,
            sameSite: Cookie::SAMESITE_STRICT,
        );
    }

    /**
     * Secure everywhere but loopback, where the local stack serves plain HTTP
     * and Safari drops a Secure cookie outright. Read off the host rather than
     * configured: a deployed host is never loopback, so there is no environment
     * variable here for somebody to get wrong in production.
     */
    private static function isSecure(Request $request): bool
    {
        return !Iter\contains(['localhost', '127.0.0.1', '::1'], $request->getHost());
    }
}
