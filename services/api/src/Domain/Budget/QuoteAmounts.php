<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Event\Interfaces\EventAmountsInterface;
use App\Entity\Event;
use App\Repository\VendorEngagementRepository;

/** A quote, current or earlier, holds the event's currency, and so does every payment under it (sc-87, "Decided, 25 Oct"). */
final readonly class QuoteAmounts implements EventAmountsInterface
{
    public function __construct(
        private VendorEngagementRepository $engagementRepository,
    ) {
    }

    public function anyRecordedFor(Event $event): bool
    {
        return $this->engagementRepository->anyOnEvent($event);
    }

    public function currencyChanged(Event $event): void
    {
    }
}
