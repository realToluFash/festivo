<?php

declare(strict_types=1);

namespace App\Tests\Unit\Http;

use App\Http\AfterResponse;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

final class AfterResponseTest extends TestCase
{
    private int $timeLimit;

    private int $ignoreUserAbort;

    protected function setUp(): void
    {
        $this->timeLimit = (int) \ini_get('max_execution_time');
        $this->ignoreUserAbort = \ignore_user_abort();
    }

    protected function tearDown(): void
    {
        \set_time_limit($this->timeLimit);
        \ignore_user_abort(1 === $this->ignoreUserAbort);
    }

    #[Test]
    public function deferredWorkRunsWithoutTheRequestsTimeLimit(): void
    {
        \set_time_limit(30);
        $afterResponse = new AfterResponse(new NullLogger());
        $limit = null;
        $afterResponse->defer(static function () use (&$limit): void {
            $limit = \ini_get('max_execution_time');
        });

        $afterResponse->run();

        self::assertSame('0', $limit);
        self::assertSame(1, \ignore_user_abort());
    }

    #[Test]
    public function aRequestWithNothingDeferredKeepsItsTimeLimit(): void
    {
        \set_time_limit(30);

        new AfterResponse(new NullLogger())->run();

        self::assertSame('30', \ini_get('max_execution_time'));
    }
}
