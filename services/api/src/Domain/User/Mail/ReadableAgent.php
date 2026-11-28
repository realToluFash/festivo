<?php

declare(strict_types=1);

namespace App\Domain\User\Mail;

use Psl\Str;

/** The device as it named itself, read as `readableAgent()` in packages/domain reads it, so an email and the devices card agree. */
final readonly class ReadableAgent
{
    private function __construct(
        public string $browser,
        public string $platform,
    ) {
    }

    public static function of(?string $userAgent): ?self
    {
        $raw = Str\trim($userAgent ?? '');

        if ('' === $raw) {
            return null;
        }

        $browser = self::browserOf($raw);
        $platform = self::platformOf($raw);

        return null === $browser || null === $platform ? null : new self($browser, $platform);
    }

    /** Order matters: every Chromium browser claims to be Chrome and Safari, and Chrome claims Safari. */
    private static function browserOf(string $raw): ?string
    {
        return match (true) {
            Str\contains($raw, 'Edg/') => 'Edge',
            Str\contains($raw, 'OPR/'), Str\contains($raw, 'Opera') => 'Opera',
            Str\contains($raw, 'SamsungBrowser') => 'Samsung Internet',
            Str\contains($raw, 'Firefox/'), Str\contains($raw, 'FxiOS') => 'Firefox',
            Str\contains($raw, 'CriOS'), Str\contains($raw, 'Chrome/') => 'Chrome',
            Str\contains($raw, 'Safari/') => 'Safari',
            default => null,
        };
    }

    private static function platformOf(string $raw): ?string
    {
        return match (true) {
            Str\contains($raw, 'iPhone') => 'iPhone',
            Str\contains($raw, 'iPad') => 'iPad',
            Str\contains($raw, 'Android') => 'Android',
            Str\contains($raw, 'Macintosh'), Str\contains($raw, 'Mac OS X') => 'macOS',
            Str\contains($raw, 'Windows') => 'Windows',
            Str\contains($raw, 'CrOS') => 'ChromeOS',
            Str\contains($raw, 'Linux') => 'Linux',
            default => null,
        };
    }
}
