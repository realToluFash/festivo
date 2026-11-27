<?php

declare(strict_types=1);

namespace App\Domain\Event\Timeline\Interfaces;

use App\Entity\Event;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

/** What an area brings up to date before one event's timeline is read, so that no milestone source writes (sc-30692). The events list and the calendar feed do not call it. */
#[AutoconfigureTag(self::TAG)]
interface TimelineOpenedInterface
{
    public const string TAG = 'app.timeline_opened';

    public function opened(Event $event): void;
}
