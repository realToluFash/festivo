<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Health\HealthChecker;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Result;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use Redis;
use RuntimeException;
use Throwable;

final class HealthCheckerTest extends TestCase
{
    #[Test]
    public function itReportsOkWhenBothDependenciesAnswer(): void
    {
        $result = $this->check()->check();

        self::assertSame('ok', $result['status']);
        self::assertSame('ok', $result['checks']['postgres']['status']);
        self::assertSame('ok', $result['checks']['redis']['status']);
    }

    #[Test]
    public function itNamesTheDependencyThatFailed(): void
    {
        $result = $this->check(dbThrows: new RuntimeException('could not translate host name'))->check();

        self::assertSame('degraded', $result['status']);
        self::assertSame('error', $result['checks']['postgres']['status']);
        // The other one still reports honestly rather than being dragged down.
        self::assertSame('ok', $result['checks']['redis']['status']);
        self::assertStringContainsString('host name', $result['checks']['postgres']['error']);
    }

    /**
     * A connection failure quotes the DSN, and the DSN carries the password.
     * This response is served to whoever asks, so the message has to be useful
     * without being a credential leak.
     */
    #[Test]
    public function itDoesNotLeakCredentialsFromADsn(): void
    {
        $leaky = new RuntimeException(
            'An exception occurred in the driver: failed to connect to postgresql://soirely:hunter2@postgres:5432/soirely',
        );

        $result = $this->check(dbThrows: $leaky)->check();
        $error = $result['checks']['postgres']['error'];

        self::assertStringNotContainsString('hunter2', $error);
        self::assertStringNotContainsString('soirely:', $error);
        self::assertSame('connection refused', $error);
    }

    #[Test]
    public function itTruncatesAVeryLongDriverMessage(): void
    {
        $result = $this->check(dbThrows: new RuntimeException(str_repeat('x', 500)))->check();

        self::assertLessThanOrEqual(120, mb_strlen($result['checks']['postgres']['error']));
    }

    #[Test]
    public function itIsDegradedWhenEitherOneIsDown(): void
    {
        $redisDown = $this->check(redisThrows: new RuntimeException('connection refused'))->check();

        self::assertSame('degraded', $redisDown['status']);
        self::assertSame('ok', $redisDown['checks']['postgres']['status']);
        self::assertSame('error', $redisDown['checks']['redis']['status']);
    }

    private function check(?Throwable $dbThrows = null, ?Throwable $redisThrows = null): HealthChecker
    {
        $connection = $this->createMock(Connection::class);
        if ($dbThrows) {
            $connection->method('executeQuery')->willThrowException($dbThrows);
        } else {
            $result = $this->createMock(Result::class);
            $result->method('fetchOne')->willReturn(1);
            $connection->method('executeQuery')->willReturn($result);
        }

        $redis = $this->createMock(Redis::class);
        if ($redisThrows) {
            $redis->method('ping')->willThrowException($redisThrows);
        } else {
            $redis->method('ping')->willReturn(true);
        }

        return new HealthChecker($connection, $redis, new NullLogger());
    }
}
