<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Command;

use App\Domain\Organisation\Deletion\DeletedOrganisationPruner;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:prune-deleted-organisations',
    description: 'Purge deleted organisations whose 30 × 24 hour restore window has closed',
)]
final readonly class PruneDeletedOrganisationsCommand
{
    public function __construct(
        private DeletedOrganisationPruner $deletedOrganisationPruner,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Option(description: 'Count what would be purged, and purge nothing')]
        bool $dryRun = false,
    ): int {
        if ($dryRun) {
            $io->writeln(Str\format('Would purge %d deleted organisations.', $this->deletedOrganisationPruner->countPrunable()));

            return Command::SUCCESS;
        }

        $io->writeln(Str\format('Purged %d deleted organisations.', $this->deletedOrganisationPruner->prune()));

        return Command::SUCCESS;
    }
}
