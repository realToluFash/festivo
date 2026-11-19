<?php

declare(strict_types=1);

namespace App\Domain\Budget\Controller;

use App\Domain\Budget\Http\BudgetSerialiser;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Repository\EventRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/** An event's budget as a range and a cost per head (sc-84): a view computed from the lines and the head counts, never stored. */
final readonly class BudgetController
{
    public function __construct(
        private EventRepository $eventRepository,
        private BudgetSerialiser $budgetSerialiser,
    ) {
    }

    #[Route('/api/events/{eventId}/budget', name: 'budget_range', methods: ['GET'])]
    #[InEvent(Permission::BudgetRead)]
    public function range(string $eventId): JsonResponse
    {
        $event = $this->eventRepository->find($eventId) ?? throw ApiException::notFound('access.not_found');

        return new JsonResponse($this->budgetSerialiser->range($event));
    }
}
