<?php

declare(strict_types=1);

namespace App\Domain\User\Command;

use App\Domain\User\UnverifiedAccountPruner;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:prune-unverified-accounts',
    description: 'Delete accounts that never verified an address, a week after registering',
)]
final readonly class PruneUnverifiedAccountsCommand
{
    public function __construct(
        private UnverifiedAccountPruner $unverifiedAccountPruner,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Option(description: 'Count what would be deleted, and delete nothing')]
        bool $dryRun = false,
    ): int {
        if ($dryRun) {
            $io->writeln(Str\format(
                'Would delete %d unverified accounts.',
                $this->unverifiedAccountPruner->countPrunable(),
            ));

            return Command::SUCCESS;
        }

        $io->writeln(Str\format(
            'Deleted %d unverified accounts, in batches of %d.',
            $this->unverifiedAccountPruner->prune(),
            UnverifiedAccountPruner::BATCH_SIZE,
        ));

        return Command::SUCCESS;
    }
}
