<?php

declare(strict_types=1);

namespace App\Domain\Menu\Interfaces;

use App\Entity\Event;

/** Sends the menu again to the pages that have it open, after a schedule change that moves a linked course's time or its link (sc-3898). */
interface MenuPublishedInterface
{
    public function published(Event $event): void;
}
