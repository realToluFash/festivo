<?php

declare(strict_types=1);

namespace App\Domain\Menu\Interfaces;

use App\Entity\Event;

/** Sends the schedule again to the pages that have it open, after a menu change that renames or removes a linked course (sc-3898). */
interface SchedulePublishedInterface
{
    public function published(Event $event): void;
}
