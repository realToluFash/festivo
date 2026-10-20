<?php

declare(strict_types=1);

namespace App\Http\Access\Directory;

use App\Http\Access\Interfaces\EventDirectoryInterface;
use Symfony\Component\Uid\Uuid;

/** Until events exist (the Events epic) there is no event to resolve, so every event route is not found. */
final readonly class NoEvents implements EventDirectoryInterface
{
    public function organisationOf(Uuid $eventId): ?Uuid
    {
        return null;
    }
}
