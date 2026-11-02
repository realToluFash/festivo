<?php

declare(strict_types=1);

namespace App\Domain\User\Command;

use App\Domain\User\RefreshTokenPruner;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:prune-refresh-tokens', description: 'Delete refresh tokens whose expiry has passed')]
final readonly class PruneRefreshTokensCommand
{
    public function __construct(
        private RefreshTokenPruner $refreshTokenPruner,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Option(description: 'Count what would be deleted, and delete nothing')]
        bool $dryRun = false,
    ): int {
        if ($dryRun) {
            $io->writeln(Str\format('Would delete %d expired refresh tokens.', $this->refreshTokenPruner->countPrunable()));

            return Command::SUCCESS;
        }

        $io->writeln(Str\format(
            'Deleted %d expired refresh tokens, in batches of %d.',
            $this->refreshTokenPruner->prune(),
            RefreshTokenPruner::BATCH_SIZE,
        ));

        return Command::SUCCESS;
    }
}
