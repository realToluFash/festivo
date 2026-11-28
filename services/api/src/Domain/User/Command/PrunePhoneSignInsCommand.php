<?php

declare(strict_types=1);

namespace App\Domain\User\Command;

use App\Repository\PhoneSignInRepository;
use Psl\Str;
use Psr\Clock\ClockInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:prune-phone-sign-ins',
    description: 'Delete phone sign-ins, with their number, typed name and codes, once their 24 hours are up',
)]
final readonly class PrunePhoneSignInsCommand
{
    public function __construct(
        private PhoneSignInRepository $phoneSignInRepository,
        private ClockInterface $clock,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Str\format('Deleted %d expired phone sign-ins.', $this->phoneSignInRepository->deleteExpired($this->clock->now())));

        return Command::SUCCESS;
    }
}
