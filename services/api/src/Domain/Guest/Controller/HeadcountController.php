<?php

declare(strict_types=1);

namespace App\Domain\Guest\Controller;

use App\Domain\Guest\Headcount\HeadcountCalculator;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Repository\EventRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/** How many are coming, for whatever shows a count (sc-99); each change is published on the event's headcount topic, which the guest list's hub token covers. */
final readonly class HeadcountController
{
    public function __construct(
        private EventRepository $eventRepository,
        private HeadcountCalculator $headcountCalculator,
    ) {
    }

    #[Route('/api/events/{eventId}/headcount', name: 'guests_headcount', methods: ['GET'])]
    #[InEvent(Permission::GuestsRead)]
    public function show(string $eventId): JsonResponse
    {
        $event = $this->eventRepository->find($eventId) ?? throw ApiException::notFound('access.not_found');

        return new JsonResponse(['headcount' => $this->headcountCalculator->forEvent($event)]);
    }
}
