<?php

declare(strict_types=1);

namespace App\Domain\Event\Interfaces;

use App\Entity\Event;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

/** Told once an edit that sent a Reply by, a start or a zone is saved: the menu, whose picks close by them (sc-3905). */
#[AutoconfigureTag(self::TAG)]
interface EventDatesMovedInterface
{
    public const string TAG = 'app.event_dates_moved';

    public function datesMoved(Event $event): void;
}
