<?php

declare(strict_types=1);

namespace App\Domain\Event\Interfaces;

use App\Entity\Event;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

/** Something that records amounts in an event's currency: a dish cost (sc-100), a cost or a payment (Budget & costs). */
#[AutoconfigureTag(self::TAG)]
interface EventAmountsInterface
{
    public const string TAG = 'app.event_amounts';

    public function anyRecordedFor(Event $event): bool;
}
