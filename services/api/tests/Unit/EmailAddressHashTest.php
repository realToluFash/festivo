<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Domain\Messaging\EmailAddressHash;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class EmailAddressHashTest extends TestCase
{
    #[Test]
    public function anAddressIsHashedLowercasedAndTrimmed(): void
    {
        $hash = new EmailAddressHash('first-key');

        self::assertSame($hash->of('ada@example.test'), $hash->of(' Ada@EXAMPLE.test '));
        self::assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $hash->of('ada@example.test'));
    }

    #[Test]
    public function underAnotherKeyTheSameAddressMatchesNothing(): void
    {
        self::assertNotSame(new EmailAddressHash('first-key')->of('ada@example.test'), new EmailAddressHash('second-key')->of('ada@example.test'));
    }

    #[Test]
    public function withoutAKeyNothingIsHashed(): void
    {
        $this->expectException(LogicException::class);

        new EmailAddressHash('')->of('ada@example.test');
    }
}
