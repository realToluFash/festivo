<?php

declare(strict_types=1);

namespace App\Domain\Budget\Controller;

use App\Domain\Budget\Http\PayersSerialiser;
use App\Domain\Budget\PayerEditor;
use App\Domain\Budget\PayerRules;
use App\Domain\Budget\SplitRules;
use App\Entity\Event;
use App\Entity\Payer;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** Who is paying (sc-91): budget.read reads it, budget.manage adds, edits and removes payers and chooses who pays. Every change publishes on the budget's topic. */
final readonly class PayersController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private PayerEditor $payerEditor,
        private PayersSerialiser $payersSerialiser,
    ) {
    }

    #[Route('/api/events/{eventId}/budget/payers', name: 'budget_payers', methods: ['GET'])]
    #[InEvent(Permission::BudgetRead)]
    public function payers(string $eventId): JsonResponse
    {
        return new JsonResponse($this->payersSerialiser->payers($this->event($eventId)));
    }

    /** Refused `payer_limit` with 20 on the event, and `validation_failed` on `name` or `note`. */
    #[Route('/api/events/{eventId}/budget/payers', name: 'budget_payers_add', methods: ['POST'])]
    #[InEvent(Permission::BudgetManage)]
    public function add(Request $request, string $eventId): JsonResponse
    {
        $payer = $this->payerEditor->add($this->event($eventId), Input::body($request, PayerRules::sentPayer()), $this->user());

        return new JsonResponse(['payer' => PayersSerialiser::payer($payer)], Response::HTTP_CREATED);
    }

    /** Choose who pays: each listed cost's split replaced, or left with no payer when `split` is null. Answers the whole read. */
    #[Route('/api/events/{eventId}/budget/payers/splits', name: 'budget_payers_choose', methods: ['PUT'], priority: 1)]
    #[InEvent(Permission::BudgetManage)]
    public function choose(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $this->payerEditor->choose($event, Input::body($request, SplitRules::sent()), $this->user());

        return new JsonResponse($this->payersSerialiser->payers($event));
    }

    #[Route('/api/events/{eventId}/budget/payers/{payerId}', name: 'budget_payers_change', methods: ['PUT'])]
    #[InEvent(Permission::BudgetManage)]
    public function change(Request $request, #[InThisEvent('payerId')] Payer $payer): JsonResponse
    {
        $changed = $this->payerEditor->change($payer, Input::body($request, PayerRules::sentPayer()), $this->user());

        return new JsonResponse(['payer' => PayersSerialiser::payer($changed)]);
    }

    /** Refused `payer_covers_costs` while their split is on any cost, with those costs' ids in `lineIds`. */
    #[Route('/api/events/{eventId}/budget/payers/{payerId}', name: 'budget_payers_remove', methods: ['DELETE'])]
    #[InEvent(Permission::BudgetManage)]
    public function remove(#[InThisEvent('payerId')] Payer $payer): Response
    {
        $this->payerEditor->remove($payer, $this->user());

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /** Undo: 404 once erased, a day after. */
    #[Route('/api/events/{eventId}/budget/payers/{payerId}/removal', name: 'budget_payers_put_back', methods: ['DELETE'])]
    #[InEvent(Permission::BudgetManage)]
    public function putBack(string $eventId, string $payerId): JsonResponse
    {
        $payer = $this->payerEditor->putBack($this->event($eventId), $payerId, $this->user());

        return new JsonResponse(['payer' => PayersSerialiser::payer($payer)]);
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
