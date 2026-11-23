<?php

declare(strict_types=1);

namespace App\Domain\Menu\Interfaces;

use App\Entity\Event;

/** Where each of an event's course items is served from (sc-3910), as the kitchen sheet reads it (sc-34244). */
interface ServingStationsInterface
{
    /** @return array{stops: non-empty-list<array{id: string, name: string}>, servedFrom: array<string, array<string, string>>} the Pass, then each place in the walking order; by course id, then item key, the stop that serves it, and an item not there is served from the Pass */
    public function of(Event $event): array;
}
