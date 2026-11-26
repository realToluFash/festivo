<?php

declare(strict_types=1);

namespace App\Domain\Service\Command;

use App\Domain\Service\ServiceHeartbeat;
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
use Symfony\Contracts\Service\ResetInterface;

/** The service heartbeat's worker (sc-4028), shaped as the notification worker is: it exits after its limits and on SIGTERM, and the container's restart picks up new code. */
#[AsCommand(name: self::NAME, description: 'Publish a heartbeat on each service topic every 10 seconds while service is on')]
final class ServiceHeartbeatCommand extends Command implements SignalableCommandInterface
{
    public const string NAME = 'app:service:heartbeat';

    private bool $stopping = false;

    public function __construct(
        private readonly ServiceHeartbeat $serviceHeartbeat,
        private readonly EntityManagerInterface $entityManager,
        #[Autowire(service: 'services_resetter')]
        private readonly ResetInterface $servicesResetter,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('once', null, InputOption::VALUE_NONE, 'Beat once, then exit')
            ->addOption('time-limit', null, InputOption::VALUE_REQUIRED, 'Exit after this many seconds', '3600')
            ->addOption('memory-limit', null, InputOption::VALUE_REQUIRED, 'Exit once memory use passes this, in megabytes', '128');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $once = Type\bool()->coerce($input->getOption('once'));
        $deadline = \microtime(true) + self::number($input->getOption('time-limit'));
        $memoryLimit = (int) (self::number($input->getOption('memory-limit')) * 1024 * 1024);
        $beats = 0;

        while (!$this->stopping) {
            $next = \microtime(true) + ServiceHeartbeat::EVERY_SECONDS;
            $beats += $this->serviceHeartbeat->beat();
            $this->entityManager->clear();
            $this->servicesResetter->reset();

            if ($once || \microtime(true) >= $deadline || \memory_get_usage(true) >= $memoryLimit) {
                break;
            }

            $this->sleepUntil($next);
        }

        $output->writeln(Str\format('Published %d service heartbeats.', $beats), OutputInterface::VERBOSITY_VERBOSE);

        return Command::SUCCESS;
    }

    /** @return list<int> */
    public function getSubscribedSignals(): array
    {
        return \defined('SIGTERM') ? [\SIGTERM, \SIGINT] : [];
    }

    public function handleSignal(int $signal, int|false $previousExitCode = 0): int|false
    {
        $this->stopping = true;

        return false;
    }

    private function sleepUntil(float $until): void
    {
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
