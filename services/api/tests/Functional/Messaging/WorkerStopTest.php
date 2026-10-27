<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\Command\WorkNotificationsCommand;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Trigger;
use App\Enum\Permission;
use App\Tests\Double\Messaging\RecordingEmailSender;
use DAMA\DoctrineTestBundle\PHPUnit\SkipDatabaseRollback;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\Test;
use Psl\Async;
use Psl\DateTime\Duration;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Type;

final class WorkerStopTest extends MessagingTestCase
{
    /** Compose's stop sends SIGTERM and kills at 10 s; without pcntl PHP never sees the signal. */
    #[Test]
    public function aStoppedWorkerExitsCleanlyWithinTenSeconds(): void
    {
        $root = self::root();
        // The stack's notification-worker beats on the default file, which would say this worker is polling before it is.
        $heartbeat = $root . '/var/notifications-worker-' . SecureRandom\string(12) . '.heartbeat';
        $worker = self::start($heartbeat, []);
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

        [$status, $elapsed] = self::stop($worker, static function (): void {});
        \unlink($heartbeat);
        $reported = self::reported($status);

        self::assertLessThan(10.0, $elapsed, $reported);
        self::assertFalse($status['signaled'], $reported);
        self::assertSame(0, $status['exitcode'], $reported);
    }

    /** Committed, because the worker reads the database from its own process; it deletes what it made. */
    #[Test]
    #[SkipDatabaseRollback]
    public function aWorkerStoppedDuringAProviderCallRecordsTheSendBeforeItExits(): void
    {
        $root = self::root();
        $token = SecureRandom\string(12);
        $heartbeat = $root . '/var/notifications-worker-' . $token . '.heartbeat';
        $gate = $root . '/var/notification-provider-' . $token;
        $members = Audience::membersWithPermission($this->organisation->getId(), Permission::BillingManage);
        $scheduled = self::scheduler()->schedule('test.notice', 'stop-mid-send-' . $token, 'stop-mid-send-' . $token, Trigger::at(new DateTimeImmutable('-1 minute')), $members);

        try {
            $worker = self::start($heartbeat, [RecordingEmailSender::GATE => $gate]);
            $deadline = \microtime(true) + 30;

            do {
                Async\sleep(Duration::milliseconds(20));
                \clearstatcache();
            } while (\microtime(true) < $deadline && \proc_get_status($worker)['running'] && !\file_exists($gate . '.called'));

            $status = \proc_get_status($worker);

            if (!$status['running']) {
                \proc_close($worker);
                self::fail('The worker exited before its provider call began, so it was not stopped. ' . self::reported($status));
            }

            if (!\file_exists($gate . '.called')) {
                \proc_terminate($worker, \SIGKILL);
                \proc_close($worker);
                self::fail('The worker had not claimed the delivery and called its provider within 30 seconds, so it was not stopped.');
            }

            // The answer waits long enough for a worker that does not finish its step to have exited already.
            [$status, $elapsed] = self::stop($worker, static function () use ($gate): void {
                Async\sleep(Duration::milliseconds(500));
                \touch($gate . '.answer');
            });

            if (\file_exists($gate . '.gave-up')) {
                self::fail('The provider gave up before the test answered it, so the SIGTERM may have landed after the call. ' . self::reported($status));
            }

            $delivery = Type\string()->coerce(self::scalar('SELECT status FROM notification_deliveries WHERE scheduled_notification_id = :id', ['id' => $scheduled->toRfc4122()]) ?: 'missing');
            $reported = self::reported($status) . Str\format(' The delivery is %s.', $delivery);

            self::assertLessThan(10.0, $elapsed, $reported);
            self::assertFalse($status['signaled'], $reported);
            self::assertSame(0, $status['exitcode'], $reported);
            self::assertSame('sent', $delivery, $reported);
        } finally {
            foreach (['.called', '.answer', '.gave-up'] as $suffix) {
                if (\file_exists($gate . $suffix)) {
                    \unlink($gate . $suffix);
                }
            }

            if (\file_exists($heartbeat)) {
                \unlink($heartbeat);
            }

            self::connection()->executeStatement('DELETE FROM scheduled_notifications WHERE id = :id', ['id' => $scheduled->toRfc4122()]);
            self::connection()->executeStatement('DELETE FROM organisations WHERE id = :id', ['id' => $this->organisation->getId()->toRfc4122()]);
            self::connection()->executeStatement('DELETE FROM users WHERE id = :id', ['id' => $this->owner->getId()->toRfc4122()]);
        }
    }

    /** @return non-empty-string */
    private static function root(): string
    {
        self::assertTrue(\extension_loaded('pcntl'), 'The api image has no pcntl, so SIGTERM cannot be caught.');

        return \dirname(__DIR__, 3);
    }

    /**
     * @param array<string, string> $environment
     *
     * @return resource
     */
    private static function start(string $heartbeat, array $environment): mixed
    {
        $worker = \proc_open(['php', 'bin/console', WorkNotificationsCommand::NAME, '--poll=1', '--heartbeat=' . $heartbeat], [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes, self::root(), [...\getenv(), ...$environment, 'APP_ENV' => 'test']);
        self::assertNotFalse($worker);

        return $worker;
    }

    /**
     * @param resource         $worker
     * @param callable(): void $meanwhile
     *
     * @return array{array{running: bool, exitcode: int, signaled: bool, termsig: int, ...}, float}
     */
    private static function stop(mixed $worker, callable $meanwhile): array
    {
        \proc_terminate($worker, \SIGTERM);
        $stopped = \microtime(true);
        $meanwhile();
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

        return [$status, $elapsed];
    }

    /** @param array{running: bool, exitcode: int, signaled: bool, termsig: int, ...} $status */
    private static function reported(array $status): string
    {
        return Str\format('proc_get_status reported running %s, exitcode %d, signaled %s, termsig %d.', \var_export($status['running'], true), $status['exitcode'], \var_export($status['signaled'], true), $status['termsig']);
    }
}
