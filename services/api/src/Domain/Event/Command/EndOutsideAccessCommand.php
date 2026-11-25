<?php

declare(strict_types=1);

namespace App\Domain\Event\Command;

use App\Domain\Event\People\OutsideAccess;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:outside-access:end', description: 'End the grants to people from outside whose event has concluded, auditing each (sc-71)')]
final readonly class EndOutsideAccessCommand
{
    public function __construct(
        private OutsideAccess $outsideAccess,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Str\format('Ended %d grants to people from outside.', $this->outsideAccess->endConcluded()));

        return Command::SUCCESS;
    }
}
