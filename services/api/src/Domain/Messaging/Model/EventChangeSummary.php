<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

/** What one member's item for an event holds (sc-13214, AC 2 to 4): its leading change, each field that still differs, and the others who made what it holds. */
final readonly class EventChangeSummary
{
    /**
     * @param array<string, array{0: mixed, 1: mixed}> $fields in EventDetails::FIELDS order, before the item began and as it is now
     * @param ?EventChangeEntry                        $other  the latest change by somebody other than the leading change's person
     * @param int                                      $more   how many more people besides that one
     */
    public function __construct(
        public EventChangeEntry $leading,
        public array $fields,
        public ?EventChangeEntry $other,
        public int $more,
        public bool $eventDay,
    ) {
    }
}
