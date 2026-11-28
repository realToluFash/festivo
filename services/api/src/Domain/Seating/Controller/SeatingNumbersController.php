<?php

declare(strict_types=1);

namespace App\Domain\Seating\Controller;

use App\Domain\Seating\Numbers\SeatingNumbers;
use App\Entity\Event;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Repository\EventRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/** The room in numbers (sc-103): tables, seats, who is taken, held, unusable or free, and who still has no seat. */
final readonly class SeatingNumbersController
{
    public function __construct(
        private EventRepository $eventRepository,
        private SeatingNumbers $seatingNumbers,
    ) {
    }

    /** Always 200: an event with no plan or an empty one answers with zeros and a `reason`. */
    #[Route('/api/events/{eventId}/seating-numbers', name: 'seating_numbers_show', methods: ['GET'])]
    #[InEvent(Permission::SeatingRead)]
    public function show(string $eventId): JsonResponse
    {
        $event = $this->eventRepository->find($eventId);

        return new JsonResponse($this->seatingNumbers->of($event instanceof Event ? $event : throw ApiException::notFound('access.not_found')));
    }
}
