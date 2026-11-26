<?php

declare(strict_types=1);

namespace App\Domain\Service\Command;

use App\Domain\Service\ServiceTaps;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:service-taps:expire', description: 'Delete service tap keys older than the 24 hours they are kept')]
final readonly class ExpireServiceTapsCommand
{
    public function __construct(
        private ServiceTaps $serviceTaps,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Option(description: 'Count what would be deleted, and delete nothing')]
        bool $dryRun = false,
    ): int {
        if ($dryRun) {
            $io->writeln(Str\format('Would delete %d service tap keys.', $this->serviceTaps->countPrunable()));

            return Command::SUCCESS;
        }

        $io->writeln(Str\format('Deleted %d service tap keys.', $this->serviceTaps->prune()));

        return Command::SUCCESS;
    }
}
