<?php

declare(strict_types=1);

namespace App\Domain\Event\Interfaces;

use App\Entity\Event;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

/** Told once End now has finished an event and the move is saved: the room screens (sc-62588). */
#[AutoconfigureTag(self::TAG)]
interface EventEndedInterface
{
    public const string TAG = 'app.event_ended';

    public function ended(Event $event): void;
}
