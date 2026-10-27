<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Command;

use App\Domain\Messaging\NotificationWorker;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psl\Type;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Command\SignalableCommandInterface;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/** Exits after its limits, on SIGTERM and when the database goes; the container's restart is the reconnect and picks up new code. */
#[AsCommand(name: self::NAME, description: 'Send the notifications that are due, most urgent first')]
final class WorkNotificationsCommand extends Command implements SignalableCommandInterface
{
    public const string NAME = 'app:notifications:work';

    /** Each provider call's limit, well inside the 5 seconds an urgent row is promised. Only this process sets it. */
    public const string SOCKET_TIMEOUT = '3';

    private bool $stopping = false;

    public function __construct(
        private readonly NotificationWorker $notificationWorker,
        private readonly EntityManagerInterface $entityManager,
        #[Autowire('%kernel.project_dir%/var/notifications-worker.heartbeat')]
        private readonly string $heartbeatPath,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('once', null, InputOption::VALUE_NONE, 'Handle everything due now, then exit')
            ->addOption('time-limit', null, InputOption::VALUE_REQUIRED, 'Exit after this many seconds', '3600')
            ->addOption('memory-limit', null, InputOption::VALUE_REQUIRED, 'Exit once memory use passes this, in megabytes', '128')
            ->addOption('poll', null, InputOption::VALUE_REQUIRED, 'Seconds to wait when nothing is due', '1');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        // @mago-expect lint:no-ini-set the per-call limit is this process's alone, and a web request keeps PHP's default
        \ini_set('default_socket_timeout', self::SOCKET_TIMEOUT);

        $once = Type\bool()->coerce($input->getOption('once'));
        $deadline = \microtime(true) + self::number($input->getOption('time-limit'));
        $memoryLimit = (int) (self::number($input->getOption('memory-limit')) * 1024 * 1024);
        $pollMicroseconds = (int) (self::number($input->getOption('poll')) * 1_000_000);
        $handled = 0;

        while (!$this->stopping) {
            $this->beat();
            $didWork = $this->notificationWorker->step();
            $this->entityManager->clear();

            if (!$this->entityManager->isOpen()) {
                $output->writeln('<error>The entity manager closed after an error; exiting for a restart.</error>');

                return Command::FAILURE;
            }

            $handled += $didWork ? 1 : 0;

            if ($once && !$didWork) {
                break;
            }

            if (\microtime(true) >= $deadline || \memory_get_usage(true) >= $memoryLimit) {
                break;
            }

            if (!$didWork) {
                $this->sleep($pollMicroseconds);
            }
        }

        $output->writeln(Str\format('Handled %d notification steps.', $handled), OutputInterface::VERBOSITY_VERBOSE);

        return Command::SUCCESS;
    }

    /** @return list<int> */
    public function getSubscribedSignals(): array
    {
        return \defined('SIGTERM') ? [\SIGTERM, \SIGINT] : [];
    }

    /** The step in hand finishes, its provider call bounded by the socket limit, then the loop ends; a row not yet sent is left for its lease to run out. */
    public function handleSignal(int $signal, int|false $previousExitCode = 0): int|false
    {
        $this->stopping = true;

        return false;
    }

    private function beat(): void
    {
        \touch($this->heartbeatPath);
    }

    private function sleep(int $microseconds): void
    {
        $until = \microtime(true) + $microseconds / 1_000_000;

        while (!$this->stopping && \microtime(true) < $until) {
            // @mago-expect lint:psl-sleep-functions Async\sleep waits in an event loop, where SIGTERM is not seen until it returns
            \usleep(50_000);
        }
    }

    private static function number(mixed $option): float
    {
        return Type\float()->coerce(Type\string()->coerce($option));
    }
}
