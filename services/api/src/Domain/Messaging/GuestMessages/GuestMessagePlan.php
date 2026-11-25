<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestMessages;

use App\Domain\Messaging\Model\PlannedDelivery;
use Psl\Iter;
use Psl\Vec;

/** Everyone a message goes to on their own page, and which of them Soirely can tell by email. */
final readonly class GuestMessagePlan
{
    /** @param non-empty-list<PlannedDelivery> $deliveries */
    public function __construct(
        public array $deliveries,
    ) {
    }

    public function toldByEmail(): int
    {
        return Iter\count(Vec\filter($this->deliveries, static fn (PlannedDelivery $delivery): bool => $delivery->isQueued()));
    }

    /** @return list<PlannedDelivery> */
    public function cantBeTold(): array
    {
        return Vec\filter($this->deliveries, static fn (PlannedDelivery $delivery): bool => !$delivery->isQueued());
    }
}
