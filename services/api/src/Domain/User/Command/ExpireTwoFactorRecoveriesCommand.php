<?php

declare(strict_types=1);

namespace App\Domain\User\Command;

use App\Domain\User\TwoFactor\Recovery\RecoveryDecisions;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

/** Run every few minutes: a request already reads as expired from its instant on, and this sends the email that says so. */
#[AsCommand(name: 'app:two-factor-recovery:expire', description: 'End the requests to get back in that nobody answered within 7 days')]
final readonly class ExpireTwoFactorRecoveriesCommand
{
    public function __construct(
        private RecoveryDecisions $recoveryDecisions,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Str\format('Ended %d requests to get back in that nobody answered.', $this->recoveryDecisions->expireDue()));

        return Command::SUCCESS;
    }
}
