<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Domain\Event\Interfaces\EventAmountsInterface;
use App\Entity\Event;
use Symfony\Component\DependencyInjection\Attribute\AutowireIterator;

/** With no conversion in the product, an amount recorded in one currency would be read in another (sc-98). */
final readonly class EventAmounts
{
    /** @param iterable<EventAmountsInterface> $sources */
    public function __construct(
        #[AutowireIterator(EventAmountsInterface::TAG)]
        private iterable $sources,
    ) {
    }

    public function anyRecordedFor(Event $event): bool
    {
        foreach ($this->sources as $source) {
            if ($source->anyRecordedFor($event)) {
                return true;
            }
        }

        return false;
    }
}
