<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Command;

use App\Domain\Organisation\SignInRules\TwoFactorHolds;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

/** Run every few minutes: a member is held back from the deadline's instant on, and this records that it happened. */
#[AsCommand(name: 'app:sign-in-rules:record-two-factor-holds', description: 'Audit each member held back by an organisation that requires two-factor')]
final readonly class RecordTwoFactorHoldsCommand
{
    public function __construct(
        private TwoFactorHolds $twoFactorHolds,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Str\format('Recorded %d members held back until they turn on two-factor.', $this->twoFactorHolds->recordDue()));

        return Command::SUCCESS;
    }
}
