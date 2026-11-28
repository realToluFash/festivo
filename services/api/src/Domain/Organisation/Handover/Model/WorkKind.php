<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Handover\Model;

/** A kind of thing a member can be responsible for (sc-614). */
enum WorkKind: string
{
    case EventLead = 'event_lead';
}
