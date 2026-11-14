<?php

declare(strict_types=1);

namespace App\Domain\Event;

use App\Http\Access\Interfaces\EventDirectoryInterface;
use App\Repository\EventRepository;
use Symfony\Component\Uid\Uuid;

final readonly class EventDirectory implements EventDirectoryInterface
{
    public function __construct(
        private EventRepository $eventRepository,
    ) {
    }

    public function organisationOf(Uuid $eventId): ?Uuid
    {
        return $this->eventRepository->findOrganisationIdOf($eventId);
    }
}
