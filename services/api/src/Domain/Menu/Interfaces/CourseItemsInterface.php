<?php

declare(strict_types=1);

namespace App\Domain\Menu\Interfaces;

use App\Entity\Event;

/** The schedule item each linked course is served from (sc-3898), by the course's id. */
interface CourseItemsInterface
{
    /** @return array<string, array{id: string, title: string, plannedAt: string, expectedAt: ?string, startedAt: ?string, endedAt: ?string}> a course's item with its planned, expected and actual times (sc-1404), in the event's zone */
    public function linkedTo(Event $event): array;
}
