<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Command;

use App\Domain\Organisation\OwnerClaims\OwnerClaimHandler;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

/** Run every minute: each claim passes or lapses as of its own instant, and a record not yet found is looked up hourly. */
#[AsCommand(name: 'app:owner-claims:run', description: 'Pass or lapse each claim to own an organisation that is due, and look up the DNS record of each not yet found, hourly')]
final readonly class RunOwnerClaimsCommand
{
    public function __construct(
        private OwnerClaimHandler $ownerClaimHandler,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Str\format('Moved %d claims to own an organisation.', $this->ownerClaimHandler->settleDue()));

        return Command::SUCCESS;
    }
}
