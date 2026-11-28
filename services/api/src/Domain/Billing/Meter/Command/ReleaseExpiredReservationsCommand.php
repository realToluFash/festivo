<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter\Command;

use App\Domain\Billing\Meter\UsageMeter;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:usage:release-expired', description: 'Release each usage reservation left unsettled for 24 hours, logging each (sc-3929)')]
final readonly class ReleaseExpiredReservationsCommand
{
    public function __construct(
        private UsageMeter $usageMeter,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Str\format('Released %d usage reservations.', $this->usageMeter->releaseExpired()));

        return Command::SUCCESS;
    }
}
