<?php

declare(strict_types=1);

namespace App\Tests\Double;

use DateTimeImmutable;
use Symfony\Component\RateLimiter\LimiterInterface;
use Symfony\Component\RateLimiter\RateLimit;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\RateLimiter\Reservation;

/**
 * A limiter with nothing left, for asserting what a controller does when the
 * budget is gone.
 *
 * It exists because the real budget cannot be exhausted over HTTP in the suite:
 * the limiter is backed by an array cache in test — see
 * config/packages/cache.yaml, which explains why — and `framework.test` resets
 * resettable services after every request, so the budget is full again before
 * the next one arrives.
 */
final readonly class RefusingRateLimiterFactory implements RateLimiterFactoryInterface
{
    /** @param ?DateTimeImmutable $retryAfter when the window ends; an hour from the refusal when null */
    public function __construct(
        private ?DateTimeImmutable $retryAfter = null,
    ) {
    }

    public function create(?string $key = null): LimiterInterface
    {
        return new readonly class($this->retryAfter) implements LimiterInterface {
            public function __construct(
                private ?DateTimeImmutable $retryAfter,
            ) {
            }

            public function consume(int $tokens = 1): RateLimit
            {
                return new RateLimit(0, $this->retryAfter ?? new DateTimeImmutable('+1 hour'), false, 10);
            }

            public function reserve(int $tokens = 1, ?float $maxTime = null): Reservation
            {
                return new Reservation(\microtime(true), $this->consume($tokens));
            }

            public function reset(): void
            {
            }
        };
    }
}
