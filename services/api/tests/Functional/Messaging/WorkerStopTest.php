<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\Command\WorkNotificationsCommand;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Async;
use Psl\DateTime\Duration;

final class WorkerStopTest extends TestCase
{
    /** Compose's stop sends SIGTERM and kills at 10 s; without pcntl PHP never sees the signal. */
    #[Test]
    public function aStoppedWorkerExitsCleanlyWithinTenSeconds(): void
    {
        self::assertTrue(\extension_loaded('pcntl'), 'The api image has no pcntl, so SIGTERM cannot be caught.');

        $root = \dirname(__DIR__, 3);
        $heartbeat = $root . '/var/notifications-worker.heartbeat';
        \touch($heartbeat, \time() - 600);
        $worker = \proc_open(['php', 'bin/console', WorkNotificationsCommand::NAME, '--poll=1'], [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes, $root, [...\getenv(), 'APP_ENV' => 'test']);
        self::assertNotFalse($worker);
        $deadline = \microtime(true) + 30;

        do {
            Async\sleep(Duration::milliseconds(200));
            \clearstatcache();
        } while (\microtime(true) < $deadline && \proc_get_status($worker)['running'] && (int) \filemtime($heartbeat) < \time() - 5);

        self::assertTrue(\proc_get_status($worker)['running'], 'The worker exited before it was stopped.');

        \proc_terminate($worker, \SIGTERM);
        $stopped = \microtime(true);

        $exitCode = null;

        while (null === $exitCode && \microtime(true) - $stopped < 15) {
            Async\sleep(Duration::milliseconds(100));
            $status = \proc_get_status($worker);
            $exitCode = $status['running'] ? null : $status['exitcode'];
        }

        self::assertLessThan(10.0, \microtime(true) - $stopped);
        self::assertSame(0, $exitCode);
        \proc_close($worker);
    }
}
