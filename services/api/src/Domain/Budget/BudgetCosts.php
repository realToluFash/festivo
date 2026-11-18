<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Event\Interfaces\EventAmountsInterface;
use App\Entity\Event;
use App\Repository\BudgetLineRepository;

/** Any budget line holds the event's currency, whatever its basis and at a price of 0 too (sc-83, "Changed, 25 Oct"). */
final readonly class BudgetCosts implements EventAmountsInterface
{
    public function __construct(
        private BudgetLineRepository $budgetLineRepository,
    ) {
    }

    public function anyRecordedFor(Event $event): bool
    {
        return $this->budgetLineRepository->anyOnEvent($event);
    }
}
