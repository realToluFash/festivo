<?php

declare(strict_types=1);

namespace App\Domain\Menu\Interfaces;

use App\Entity\Event;
use App\Entity\MenuCourse;

/** Where each of an event's course items is served from (sc-3910), as the kitchen sheet reads it (sc-34244). */
interface ServingStationsInterface
{
    /** @return array{stops: non-empty-list<array{id: string, name: string}>, courses: list<array{course: MenuCourse, items: list<array{name: string, key: string, stop: string}>}>} the Pass, then each place in the walking order; each course's items as the menu has them now, each with the stop that serves it */
    public function of(Event $event): array;
}
