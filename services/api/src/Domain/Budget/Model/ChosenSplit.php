<?php

declare(strict_types=1);

namespace App\Domain\Budget\Model;

use App\Entity\BudgetLine;
use App\Entity\Payer;
use App\Enum\PayerSplit;

/** Choose who pays as checked (sc-91): the costs, and the split each takes, or none for Leave with no payer. */
final readonly class ChosenSplit
{
    /**
     * @param list<BudgetLine>                              $lines
     * @param list<array{payer: Payer, value: int}>         $parts a percentage in hundredths, a fixed amount in the minor unit, or all of it
     */
    public function __construct(
        public array $lines,
        public ?PayerSplit $split,
        public array $parts,
        public ?Payer $rest,
    ) {
    }
}
