<?php

declare(strict_types=1);

namespace App\Tests\Double;

use App\Domain\Event\Interfaces\EventAmountsInterface;
use App\Entity\Event;

/** Records an amount against an event without building whatever would record it. */
final class ScriptedEventAmounts implements EventAmountsInterface
{
    /** @var array<string, true> */
    private array $recorded = [];

    public function record(string $eventId): void
    {
        $this->recorded[$eventId] = true;
    }

    public function anyRecordedFor(Event $event): bool
    {
        return isset($this->recorded[$event->getId()->toRfc4122()]);
    }
}
