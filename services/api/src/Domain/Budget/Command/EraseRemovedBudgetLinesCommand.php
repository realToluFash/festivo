<?php

declare(strict_types=1);

namespace App\Domain\Budget\Command;

use App\Domain\Budget\BudgetEditor;
use Psl\Str;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:erase-removed-budget-lines', description: 'Erase the budget lines removed more than a day ago that nobody put back (sc-85)')]
final readonly class EraseRemovedBudgetLinesCommand
{
    public function __construct(
        private BudgetEditor $budgetEditor,
    ) {
    }

    public function __invoke(SymfonyStyle $io): int
    {
        $io->writeln(Str\format('Erased %d removed budget lines.', $this->budgetEditor->eraseLapsed()));

        return Command::SUCCESS;
    }
}
