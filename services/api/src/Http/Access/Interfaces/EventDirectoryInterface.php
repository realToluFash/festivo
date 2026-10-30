<?php

declare(strict_types=1);

namespace App\Http\Access\Interfaces;

use Symfony\Component\Uid\Uuid;

interface EventDirectoryInterface
{
    /** The organisation an event belongs to, or null when there is no such event. */
    public function organisationOf(Uuid $eventId): ?Uuid;
}
