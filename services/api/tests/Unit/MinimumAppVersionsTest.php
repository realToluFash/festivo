<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\AppVersion\Exception\MinimumAppVersionMalformed;
use App\AppVersion\MinimumAppVersions;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class MinimumAppVersionsTest extends TestCase
{
    #[Test]
    public function eachPlatformIsSetOnItsOwn(): void
    {
        $minimumAppVersions = new MinimumAppVersions('1.10.0', '0.9.3');

        self::assertSame('1.10.0', $minimumAppVersions->ios);
        self::assertSame('0.9.3', $minimumAppVersions->android);
    }

    #[Test]
    public function unsetOrEmptyIsNoMinimum(): void
    {
        $minimumAppVersions = new MinimumAppVersions(null, '');

        self::assertNull($minimumAppVersions->ios);
        self::assertNull($minimumAppVersions->android);
    }

    /** @return iterable<string, array{string}> */
    public static function notAVersion(): iterable
    {
        yield 'two numbers' => ['1.2'];
        yield 'a prefix' => ['v1.2.0'];
        yield 'a word' => ['latest'];
        yield 'four numbers' => ['1.2.0.1'];
        yield 'a pre-release' => ['1.2.0-beta'];
        yield 'a leading zero' => ['1.02.0'];
        yield 'a space' => [' 1.2.0'];
    }

    #[Test]
    #[DataProvider('notAVersion')]
    public function anythingButThreeNumbersRefusesNamingTheSetting(string $value): void
    {
        $this->expectException(MinimumAppVersionMalformed::class);
        $this->expectExceptionMessage('MINIMUM_APP_VERSION_ANDROID is "' . $value . '"');

        new MinimumAppVersions('1.0.0', $value);
    }
}
