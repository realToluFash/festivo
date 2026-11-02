<?php

declare(strict_types=1);

namespace App\Tests\Unit\Messaging;

use App\Domain\Messaging\Backoff;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class BackoffTest extends TestCase
{
    #[Test]
    public function fiveAttemptsSpanAboutAnHour(): void
    {
        $total = 0;

        for ($attempt = 1; $attempt < Backoff::ATTEMPTS; ++$attempt) {
            $total += Backoff::secondsAfter($attempt, 0.0);
        }

        self::assertSame(5, Backoff::ATTEMPTS);
        self::assertSame(3600, $total);
    }

    #[Test]
    public function eachWaitIsLongerThanTheLastWhateverTheJitter(): void
    {
        for ($attempt = 1; $attempt < Backoff::ATTEMPTS - 1; ++$attempt) {
            self::assertLessThan(Backoff::secondsAfter($attempt + 1, -1.0), Backoff::secondsAfter($attempt, 1.0));
        }
    }
}
