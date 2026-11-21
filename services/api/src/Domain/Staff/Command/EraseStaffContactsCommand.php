<?php

declare(strict_types=1);

namespace App\Domain\Staff\Command;

use App\Domain\Staff\StaffContactsEraser;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:erase-staff-contacts', description: 'Erase roster mobile numbers and emails 30 days after their event finishes (sc-3906)')]
final readonly class EraseStaffContactsCommand
{
    public function __construct(
        private StaffContactsEraser $staffContactsEraser,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Str\format('Erased the contact details of %d roster entries.', $this->staffContactsEraser->eraseDue()));

        return Command::SUCCESS;
    }
}
