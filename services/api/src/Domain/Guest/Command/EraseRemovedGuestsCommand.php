<?php

declare(strict_types=1);

namespace App\Domain\Guest\Command;

use App\Domain\Guest\Removal\GuestRemovals;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:erase-removed-guests', description: 'Erase the guests taken off a list whose page never said their undo ran out (sc-3774)')]
final readonly class EraseRemovedGuestsCommand
{
    public function __construct(
        private GuestRemovals $guestRemovals,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Str\format('Erased %d removed guests.', $this->guestRemovals->eraseLapsed()));

        return Command::SUCCESS;
    }
}
