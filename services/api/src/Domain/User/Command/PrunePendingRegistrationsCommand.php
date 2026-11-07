<?php

declare(strict_types=1);

namespace App\Domain\User\Command;

use App\Repository\PendingRegistrationRepository;
use Psl\Str;
use Psr\Clock\ClockInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:prune-pending-registrations',
    description: 'Delete sign-ups whose code was never entered, once their 24 hours are up',
)]
final readonly class PrunePendingRegistrationsCommand
{
    public function __construct(
        private PendingRegistrationRepository $pendingRegistrationRepository,
        private ClockInterface $clock,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Str\format('Deleted %d expired registrations.', $this->pendingRegistrationRepository->deleteExpired($this->clock->now())));

        return Command::SUCCESS;
    }
}
