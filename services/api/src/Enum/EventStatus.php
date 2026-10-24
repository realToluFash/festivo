<?php

declare(strict_types=1);

namespace App\Enum;

/** Where an event is in its lifecycle. Every event starts as a Draft (sc-1486); the rest arrive with epic 29's lifecycle stories. */
enum EventStatus: string
{
    case Draft = 'draft';
}
