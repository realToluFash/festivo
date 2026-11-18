<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Http\BudgetSerialiser;
use App\Entity\Event;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;

/** After any change to an event's lines, all of them to budget.read holders on that event alone (sc-83, sc-1439). */
final readonly class BudgetPublisher
{
    public function __construct(
        private RealtimePublisher $realtimePublisher,
        private BudgetSerialiser $budgetSerialiser,
    ) {
    }

    public function publish(Event $event): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventBudget, $event->getId()->toRfc4122(), $this->budgetSerialiser->list($event));
    }
}
