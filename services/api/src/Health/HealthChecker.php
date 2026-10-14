<?php

declare(strict_types=1);

namespace App\Health;

use Doctrine\DBAL\Connection;
use Psr\Log\LoggerInterface;
use Redis;
use Throwable;

final readonly class HealthChecker
{
    public function __construct(
        private Connection $connection,
        private Redis $redis,
        private LoggerInterface $logger,
    ) {
    }

    /** @return array{status: string, checks: array<string, array{status: string, error?: string}>} */
    public function check(): array
    {
        $checks = [
            'postgres' => $this->attempt(fn () => $this->connection->executeQuery('SELECT 1')->fetchOne()),
            'redis' => $this->attempt(fn () => $this->redis->ping()),
        ];

        $healthy = array_reduce(
            $checks,
            static fn (bool $carry, array $c): bool => $carry && 'ok' === $c['status'],
            true,
        );

        return [
            'status' => $healthy ? 'ok' : 'degraded',
            'checks' => $checks,
        ];
    }

    /** @return array{status: string, error?: string} */
    private function attempt(callable $probe): array
    {
        try {
            $probe();

            return ['status' => 'ok'];
        } catch (Throwable $e) {
            $this->logger->error('Health check failed', ['exception' => $e]);

            return [
                'status' => 'error',
                'error' => $this->safeMessage($e),
            ];
        }
    }

    private function safeMessage(Throwable $e): string
    {
        $message = $e->getMessage();

        if (preg_match('#://[^@\s]+@#', $message)) {
            return 'connection refused';
        }

        return mb_substr($message, 0, 120);
    }
}
