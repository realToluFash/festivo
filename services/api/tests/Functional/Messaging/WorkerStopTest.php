<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\Command\WorkNotificationsCommand;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Async;
use Psl\DateTime\Duration;
use Psl\SecureRandom;
use Psl\Str;

final class WorkerStopTest extends TestCase
{
    /** Compose's stop sends SIGTERM and kills at 10 s; without pcntl PHP never sees the signal. */
    #[Test]
    public function aStoppedWorkerExitsCleanlyWithinTenSeconds(): void
    {
        self::assertTrue(\extension_loaded('pcntl'), 'The api image has no pcntl, so SIGTERM cannot be caught.');

        $root = \dirname(__DIR__, 3);
        // The stack's notification-worker beats on the default file, which would say this worker is polling before it is.
        $heartbeat = $root . '/var/notifications-worker-' . SecureRandom\string(12) . '.heartbeat';
        $worker = \proc_open(['php', 'bin/console', WorkNotificationsCommand::NAME, '--poll=1', '--heartbeat=' . $heartbeat], [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes, $root, [...\getenv(), 'APP_ENV' => 'test']);
        self::assertNotFalse($worker);
        $deadline = \microtime(true) + 30;

        do {
            Async\sleep(Duration::milliseconds(200));
            \clearstatcache();
        } while (\microtime(true) < $deadline && \proc_get_status($worker)['running'] && !\file_exists($heartbeat));

        $polling = \file_exists($heartbeat);
        $status = \proc_get_status($worker);

        if (!$status['running']) {
            \proc_close($worker);

            if ($polling) {
                \unlink($heartbeat);
            }

            self::fail('The worker exited before it was stopped. ' . self::reported($status));
        }

        if (!$polling) {
            \proc_terminate($worker, \SIGKILL);
            \proc_close($worker);
            self::fail('The worker had not begun polling within 30 seconds, so it was not stopped.');
        }

        \proc_terminate($worker, \SIGTERM);
        $stopped = \microtime(true);

        $status = \proc_get_status($worker);

        while ($status['running'] && \microtime(true) - $stopped < 15) {
            Async\sleep(Duration::milliseconds(100));
            $status = \proc_get_status($worker);
        }

        $elapsed = \microtime(true) - $stopped;

        if ($status['running']) {
            \proc_terminate($worker, \SIGKILL);
        }

        \proc_close($worker);
        \unlink($heartbeat);
        $reported = self::reported($status);

        self::assertLessThan(10.0, $elapsed, $reported);
        self::assertFalse($status['signaled'], $reported);
        self::assertSame(0, $status['exitcode'], $reported);
    }

    /** @param array{running: bool, exitcode: int, signaled: bool, termsig: int, ...} $status */
    private static function reported(array $status): string
    {
        return Str\format('proc_get_status reported running %s, exitcode %d, signaled %s, termsig %d.', \var_export($status['running'], true), $status['exitcode'], \var_export($status['signaled'], true), $status['termsig']);
    }
}
