<?php

declare(strict_types=1);

namespace App\Domain\Budget\Controller;

use App\Domain\Budget\BudgetEditor;
use App\Domain\Budget\Http\BudgetSerialiser;
use App\Domain\Budget\LineRules;
use App\Entity\BudgetLine;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Realtime\SubscriberTokenIssuer;
use App\Repository\EventRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** An event's budget lines (sc-83): budget.read sees them, budget.manage changes them. No screen yet; sc-85's Budget page reads these. */
final readonly class BudgetLinesController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private BudgetEditor $budgetEditor,
        private BudgetSerialiser $budgetSerialiser,
        private SubscriberTokenIssuer $subscriberTokenIssuer,
    ) {
    }

    #[Route('/api/events/{eventId}/budget/lines', name: 'budget_lines_list', methods: ['GET'])]
    #[InEvent(Permission::BudgetRead)]
    public function list(string $eventId): JsonResponse
    {
        return new JsonResponse($this->budgetSerialiser->list($this->event($eventId)));
    }

    #[Route('/api/events/{eventId}/budget/lines/{lineId}', name: 'budget_lines_show', methods: ['GET'])]
    #[InEvent(Permission::BudgetRead)]
    public function show(#[InThisEvent('lineId')] BudgetLine $line): JsonResponse
    {
        return new JsonResponse(['line' => $this->budgetSerialiser->one($line)]);
    }

    /** `rate` on a per-something line, `amount` on a fixed one, neither on a staff-time line; with either, `currency` is the event's. Refused `validation_failed` on each field at once. */
    #[Route('/api/events/{eventId}/budget/lines', name: 'budget_lines_add', methods: ['POST'])]
    #[InEvent(Permission::BudgetManage)]
    public function add(Request $request, string $eventId): JsonResponse
    {
        $line = $this->budgetEditor->add($this->event($eventId), Input::body($request, LineRules::sent()), $this->user());

        return new JsonResponse(['line' => $this->budgetSerialiser->one($line)], Response::HTTP_CREATED);
    }

    /** The whole line, checked as Add checks it. */
    #[Route('/api/events/{eventId}/budget/lines/{lineId}', name: 'budget_lines_change', methods: ['PUT'])]
    #[InEvent(Permission::BudgetManage)]
    public function change(Request $request, #[InThisEvent('lineId')] BudgetLine $line): JsonResponse
    {
        $changed = $this->budgetEditor->change($line, Input::body($request, LineRules::sent()), $this->user());

        return new JsonResponse(['line' => $this->budgetSerialiser->one($changed)]);
    }

    /** Off the budget and every figure at once, kept a day for `removal`'s Undo. */
    #[Route('/api/events/{eventId}/budget/lines/{lineId}', name: 'budget_lines_remove', methods: ['DELETE'])]
    #[InEvent(Permission::BudgetManage)]
    public function remove(#[InThisEvent('lineId')] BudgetLine $line): Response
    {
        $this->budgetEditor->remove($line, $this->user());

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /** Undo: the removed line back as it was. 404 once erased, as for a line never on this event. */
    #[Route('/api/events/{eventId}/budget/lines/{lineId}/removal', name: 'budget_lines_put_back', methods: ['DELETE'])]
    #[InEvent(Permission::BudgetManage)]
    public function putBack(string $eventId, string $lineId): JsonResponse
    {
        $line = $this->budgetEditor->putBack($this->event($eventId), $lineId, $this->user());

        return new JsonResponse(['line' => $this->budgetSerialiser->one($line)]);
    }

    /** A hub token for this event's budget; every change publishes all its lines there. */
    #[Route('/api/events/{eventId}/budget/subscriptions', name: 'budget_subscribe', methods: ['POST'])]
    #[InEvent(Permission::BudgetRead)]
    public function subscribe(string $eventId): JsonResponse
    {
        $issued = $this->subscriberTokenIssuer->issueForEventBudget($this->event($eventId)->getId());

        return new JsonResponse([
            'token' => $issued->token,
            'expiresAt' => $issued->expiresAt->format(\DATE_ATOM),
        ]);
    }

    private function event(string $id): Event
    {
        return $this->eventRepository->find($id) ?? throw ApiException::notFound('access.not_found');
    }

    private function user(): User
    {
        $user = $this->security->getUser();

        return $user instanceof User ? $user : throw new ApiException(ErrorCode::Unauthenticated, 'access.sign_in');
    }
}
