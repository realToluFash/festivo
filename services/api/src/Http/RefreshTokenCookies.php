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

    /** Secure everywhere except loopback: Safari drops a Secure cookie on plain-http localhost. */
    private static function isSecure(Request $request): bool
    {
        return !Iter\contains(['localhost', '127.0.0.1', '::1'], $request->getHost());
    }
}
