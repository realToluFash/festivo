<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Http\QuoteSerialiser;
use App\Entity\Event;
use App\Enum\RealtimeTopic;
use App\Realtime\RealtimePublisher;

/** After any change to an event's quotes or schedules, all of them to budget.read holders on that event alone (sc-87, sc-1439). */
final readonly class QuotePublisher
{
    public function __construct(
        private RealtimePublisher $realtimePublisher,
        private QuoteSerialiser $quoteSerialiser,
    ) {
    }

    public function publish(Event $event): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventQuotes, $event->getId()->toRfc4122(), $this->quoteSerialiser->list($event));
    }
}
