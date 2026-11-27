<?php

declare(strict_types=1);

namespace App\Repository;

use App\Enum\EventType;
use DateTimeImmutable;

/** What Events is searched and filtered by (sc-30302): choices within one filter widen, different filters narrow. */
final readonly class EventSearch
{
    public const int SHORTEST_TERM = 2;

    /**
     * @param list<EventType> $types
     * @param list<string>    $hosts
     */
    public function __construct(
        public ?string $term = null,
        public array $types = [],
        public ?DateTimeImmutable $from = null,
        public ?DateTimeImmutable $to = null,
        public array $hosts = [],
    ) {
    }
}
