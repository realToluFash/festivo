<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\User\Mail\ReadableAgent;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/** The same cases as packages/domain/src/userAgent.test.ts, so an email and the devices card name a device alike. */
final class ReadableAgentTest extends TestCase
{
    #[Test]
    #[DataProvider('agents')]
    public function itReadsWhatTheDevicesCardReads(string $agent, string $browser, string $platform): void
    {
        $read = ReadableAgent::of($agent);

        self::assertSame([$browser, $platform], null === $read ? null : [$read->browser, $read->platform]);
    }

    /** @return iterable<string, array{string, string, string}> */
    public static function agents(): iterable
    {
        yield 'Chrome on macOS' => ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', 'Chrome', 'macOS'];
        yield 'Safari on iPhone' => ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', 'Safari', 'iPhone'];
        yield 'Edge on Windows' => ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0', 'Edge', 'Windows'];
        yield 'Firefox on Linux' => ['Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0', 'Firefox', 'Linux'];
        yield 'Chrome on iOS' => ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1', 'Chrome', 'iPhone'];
        yield 'Samsung Internet on Android' => ['Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36', 'Samsung Internet', 'Android'];
    }

    #[Test]
    public function itGivesUpOnAStringItCannotReadRatherThanGuessing(): void
    {
        foreach (['Soirely/1.0 (+https://soirely.com)', 'curl/8.7.1', 'okhttp/4.12.0', '   ', null] as $agent) {
            self::assertNull(ReadableAgent::of($agent));
        }
    }
}
