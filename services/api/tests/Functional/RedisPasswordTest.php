<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Integrations\Redis\RedisFactory;
use App\Tests\FunctionalTestCase;
use PHPUnit\Framework\Attributes\Test;
use Psl\Type;
use RedisException;
use SensitiveParameter;

/** sc-1612: the test Redis has no password, so it refuses any AUTH it is sent. */
final class RedisPasswordTest extends FunctionalTestCase
{
    #[Test]
    public function anEmptyPasswordSendsNoAuth(): void
    {
        self::assertTrue($this->factory('')->create()->ping());
    }

    #[Test]
    public function aSetPasswordIsSentAndTheUnprotectedTestRedisRefusesIt(): void
    {
        $this->expectException(RedisException::class);
        $this->expectExceptionMessageMatches('/AUTH/');

        $this->factory('a-deployed-password')->create();
    }

    private function factory(#[SensitiveParameter] string $password): RedisFactory
    {
        return new RedisFactory(
            Type\string()->coerce($_SERVER['REDIS_HOST']),
            Type\int()->coerce($_SERVER['REDIS_PORT_INTERNAL']),
            $password,
        );
    }
}
