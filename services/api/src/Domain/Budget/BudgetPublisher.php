<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Billing\Entitlements;
use App\Domain\Budget\Http\BudgetSerialiser;
use App\Domain\Budget\Http\MarginSerialiser;
use App\Entity\Event;
use App\Enum\PlanFeature;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;

/** The lines to budget.read holders (sc-83, sc-1439); the margin on its own topic, only budget.margin's, and never without the plan (sc-92). */
final readonly class BudgetPublisher
{
    public function __construct(
        private RealtimePublisher $realtimePublisher,
        private BudgetSerialiser $budgetSerialiser,
        private MarginSerialiser $marginSerialiser,
        private Entitlements $entitlements,
    ) {
    }

    public function publish(Event $event): void
    {
        $id = $event->getId()->toRfc4122();
        $this->realtimePublisher->publish(RealtimeTopic::EventBudget, $id, $this->budgetSerialiser->list($event));

        if ($this->entitlements->of($event->getOrganisation()->getId())->unlocks(PlanFeature::Margin)) {
            $this->realtimePublisher->publish(RealtimeTopic::EventBudgetMargin, $id, $this->marginSerialiser->margin($event));
        }
    }
}
