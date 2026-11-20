<?php

declare(strict_types=1);

namespace App\Domain\Budget\Controller;

use App\Domain\Budget\Http\MarginSerialiser;
use App\Domain\Budget\MarginEditor;
use App\Domain\Budget\MarginRules;
use App\Entity\BudgetLine;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\CostCategory;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\PlanFeature;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Realtime\SubscriberTokenIssuer;
use App\Repository\EventRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

/** An event's client prices, markups and margin (sc-92): budget.margin on an organisation whose plan unlocks margin, refused `plan_required` on reading too. Every change answers with the whole margin. */
final readonly class MarginController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private MarginEditor $marginEditor,
        private MarginRules $marginRules,
        private MarginSerialiser $marginSerialiser,
        private SubscriberTokenIssuer $subscriberTokenIssuer,
    ) {
    }

    #[Route('/api/events/{eventId}/budget/margin', name: 'budget_margin', methods: ['GET'])]
    #[InEvent(Permission::BudgetMargin, feature: PlanFeature::Margin, featureLocksReading: true)]
    public function margin(string $eventId): JsonResponse
    {
        return new JsonResponse($this->marginSerialiser->margin($this->event($eventId)));
    }

    /** The whole event's markup: `markup` "20" or "12.5"; null or blank clears it. */
    #[Route('/api/events/{eventId}/budget/markup', name: 'budget_markup_event', methods: ['PUT'])]
    #[InEvent(Permission::BudgetMargin, feature: PlanFeature::Margin, featureLocksReading: true)]
    public function eventMarkup(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $this->marginEditor->setMarkup($event, null, $this->marginRules->markup(Input::body($request, MarginRules::sentMarkup())), $this->user());

        return new JsonResponse($this->marginSerialiser->margin($event));
    }

    /** One category's, over the event's; null or blank takes the event's again. */
    #[Route('/api/events/{eventId}/budget/markups/{category}', name: 'budget_markup_category', methods: ['PUT'])]
    #[InEvent(Permission::BudgetMargin, feature: PlanFeature::Margin, featureLocksReading: true)]
    public function categoryMarkup(Request $request, string $eventId, string $category): JsonResponse
    {
        $event = $this->event($eventId);
        $in = CostCategory::tryFrom($category) ?? throw ApiException::notFound('access.not_found');
        $this->marginEditor->setMarkup($event, $in, $this->marginRules->markup(Input::body($request, MarginRules::sentMarkup())), $this->user());

        return new JsonResponse($this->marginSerialiser->margin($event));
    }

    /** One line's: `markup` of its own, or `price` with `currency` for the whole line; neither takes its category's or the event's again. */
    #[Route('/api/events/{eventId}/budget/lines/{lineId}/charge', name: 'budget_line_charge', methods: ['PUT'])]
    #[InEvent(Permission::BudgetMargin, feature: PlanFeature::Margin, featureLocksReading: true)]
    public function charge(Request $request, #[InThisEvent('lineId')] BudgetLine $line): JsonResponse
    {
        $charge = $this->marginRules->charge(Input::body($request, MarginRules::sentCharge()), $line->getEvent()->getCurrency());
        $this->marginEditor->charge($line, $charge['markup'], $charge['price'], $this->user());

        return new JsonResponse($this->marginSerialiser->margin($line->getEvent()));
    }

    /** A hub token for this event's margin and the headcount that moves it. */
    #[Route('/api/events/{eventId}/budget/margin/subscriptions', name: 'budget_margin_subscribe', methods: ['POST'])]
    #[InEvent(Permission::BudgetMargin, feature: PlanFeature::Margin, featureLocksReading: true)]
    public function subscribe(string $eventId): JsonResponse
    {
        $issued = $this->subscriberTokenIssuer->issueForEventBudgetMargin($this->event($eventId)->getId());

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
