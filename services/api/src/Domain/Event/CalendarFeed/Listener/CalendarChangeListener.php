<?php

declare(strict_types=1);

namespace App\Domain\Event\CalendarFeed\Listener;

use App\Entity\Event;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsEntityListener;
use Doctrine\ORM\Event\PreUpdateEventArgs;
use Doctrine\ORM\Events;
use Psl\Iter;
use Psr\Clock\ClockInterface;

/** A guest's subscribed calendar takes a higher SEQUENCE for a changed name, time or venue, a call-off or a deletion, and for nothing else (sc-3627). */
#[AsEntityListener(event: Events::preUpdate, entity: Event::class)]
final readonly class CalendarChangeListener
{
    private const array SHOWN = [
        'name',
        'startsAt',
        'endsAt',
        'startsAtUtc',
        'endsAtUtc',
        'timeZone',
        'venueName',
        'venueAddress',
        'endedAt',
        'deletedAt',
    ];

    public function __construct(
        private ClockInterface $clock,
    ) {
    }

    public function preUpdate(Event $event, PreUpdateEventArgs $args): void
    {
        if (Iter\any(self::SHOWN, $args->hasChangedField(...))) {
            $event->calendarChanged($this->clock->now());
        }
    }
}
