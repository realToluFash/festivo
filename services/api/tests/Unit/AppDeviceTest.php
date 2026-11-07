<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\User\Mail\AppDevice;
use App\Domain\User\Mail\ReadableAgent;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/** The same cases as packages/domain/src/userAgent.test.ts, so an email and the devices card name the app alike. */
final class AppDeviceTest extends TestCase
{
    #[Test]
    public function itReadsTheDeviceClassOutOfTheAppsOwnFormat(): void
    {
        self::assertSame(AppDevice::IPhone, AppDevice::of('Soirely/1.4.0 (iOS 18.1; iPhone)'));
        self::assertSame(AppDevice::IPad, AppDevice::of('Soirely/1.4.0 (iPadOS 18.1; iPad)'));
        self::assertSame(AppDevice::Phone, AppDevice::of('Soirely/1.4.0 (Android 15; phone)'));
        self::assertSame(AppDevice::Tablet, AppDevice::of('Soirely/1.4.0 (Android 15; tablet)'));
        self::assertNull(ReadableAgent::of('Soirely/1.4.0 (iOS 18.1; iPhone)'), 'never read as a browser on an iPhone');
    }

    #[Test]
    public function itReadsOnlyTheWholeFormat(): void
    {
        foreach ([
            'Soirely/1.0 (+https://soirely.com)',
            'Soirely/1.4.0 (Android 15; watch)',
            'Soirely/1.4.0 (iOS 18.1; iPhone) extra',
            'Soirely-QA/1.0 (iOS 18.1; iPhone)',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Safari/604.1',
            '   ',
            null,
        ] as $agent) {
            self::assertNull(AppDevice::of($agent));
        }
    }
}
