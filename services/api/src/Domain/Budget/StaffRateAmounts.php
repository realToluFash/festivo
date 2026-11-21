<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Event\Interfaces\EventAmountsInterface;
use App\Entity\Event;
use App\Repository\StaffRateRepository;

/** A job's rate or a person's own holds the event's currency, at 0 too (sc-101, "Decided, 25 Oct"); once none is left, it no longer does. */
final readonly class StaffRateAmounts implements EventAmountsInterface
{
    public function __construct(
        private StaffRateRepository $staffRateRepository,
    ) {
    }

    public function anyRecordedFor(Event $event): bool
    {
        return $this->staffRateRepository->anyOnEvent($event);
    }

    public function currencyChanged(Event $event): void
    {
    }
}
