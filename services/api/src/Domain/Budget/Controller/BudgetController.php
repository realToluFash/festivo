<?php

declare(strict_types=1);

namespace App\Domain\Budget\Controller;

use App\Domain\Budget\Http\BudgetSerialiser;
use App\Domain\Budget\QuantityResolver;
use App\Domain\Budget\WhatIfRules;
use App\Enum\Permission;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** An event's budget as a range and a cost per head (sc-84): a view computed from the lines and the head counts, never stored. */
final readonly class BudgetController
{
    public function __construct(
        private EventRepository $eventRepository,
        private BudgetSerialiser $budgetSerialiser,
        private QuantityResolver $quantityResolver,
        private WhatIfRules $whatIfRules,
    ) {
    }

    #[Route('/api/events/{eventId}/budget', name: 'budget_range', methods: ['GET'])]
    #[InEvent(Permission::BudgetRead)]
    public function range(string $eventId): JsonResponse
    {
        $event = $this->eventRepository->find($eventId) ?? throw ApiException::notFound('access.not_found');

        return new JsonResponse($this->budgetSerialiser->range($event));
    }

    /** Safe in effect though not by method (RFC 9110 §9.2.1): the changes are a list in the body, and nothing is written. */
    #[Route('/api/events/{eventId}/budget/what-if', name: 'budget_what_if', methods: ['POST'])]
    #[InEvent(Permission::BudgetRead)]
    public function whatIf(Request $request, string $eventId): JsonResponse
    {
        $event = $this->eventRepository->find($eventId) ?? throw ApiException::notFound('access.not_found');
        $facts = $this->quantityResolver->factsFor($event);
        $changes = $this->whatIfRules->changes(Input::body($request, WhatIfRules::sent()), $facts);

        return new JsonResponse($this->budgetSerialiser->whatIf($event, $facts, $changes));
    }
}
