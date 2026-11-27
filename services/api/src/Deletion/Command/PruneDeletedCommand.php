<?php

declare(strict_types=1);

namespace App\Deletion\Command;

use App\Deletion\Pruner;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:prune-deleted',
    description: 'Purge whatever was deleted and whose 30 × 24 hour restore window has closed',
)]
final readonly class PruneDeletedCommand
{
    public function __construct(
        private Pruner $pruner,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Option(description: 'Count what would be purged, and purge nothing')]
        bool $dryRun = false,
    ): int {
        if ($dryRun) {
            $io->writeln(Str\format('Would purge %d deleted items.', $this->pruner->countPrunable()));

            return Command::SUCCESS;
        }

        $io->writeln(Str\format('Purged %d deleted items.', $this->pruner->prune()));

        return Command::SUCCESS;
    }
}
