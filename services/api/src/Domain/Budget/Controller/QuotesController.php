<?php

declare(strict_types=1);

namespace App\Domain\Budget\Controller;

use App\Domain\Budget\Http\QuoteSerialiser;
use App\Domain\Budget\PaymentEditor;
use App\Domain\Budget\QuoteEditor;
use App\Domain\Budget\QuoteRules;
use App\Entity\Event;
use App\Entity\ScheduledPayment;
use App\Entity\User;
use App\Entity\Vendor;
use App\Entity\VendorEngagement;
use App\Enum\ErrorCode;
use App\Enum\Permission;
use App\Enum\PlanFeature;
use App\Http\Access\InThisEvent;
use App\Http\Access\Policy\InEvent;
use App\Http\Exception\ApiException;
use App\Http\Input;
use App\Repository\EventRepository;
use App\Repository\VendorEngagementRepository;
use App\Repository\VendorRepository;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** An event's quotes and payment schedules (sc-87): budget.read sees them; budget.manage, on a plan with vendors, changes them. After a downgrade they stay readable. */
final readonly class QuotesController
{
    public function __construct(
        private Security $security,
        private EventRepository $eventRepository,
        private VendorRepository $vendorRepository,
        private VendorEngagementRepository $engagementRepository,
        private QuoteEditor $quoteEditor,
        private PaymentEditor $paymentEditor,
        private QuoteSerialiser $quoteSerialiser,
    ) {
    }

    /** Every vendor quoted on the event, with its quote, earlier quotes, lines and schedule; and everything due, soonest first. */
    #[Route('/api/events/{eventId}/budget/quotes', name: 'budget_quotes_list', methods: ['GET'])]
    #[InEvent(Permission::BudgetRead)]
    public function list(string $eventId): JsonResponse
    {
        return new JsonResponse($this->quoteSerialiser->list($this->event($eventId)));
    }

    /** The quote form's Vendor field: the organisation's vendors not archived, A to Z ignoring case, each with only its name, category and contact name, whoever chooses (sc-87, decided 7 Nov). */
    #[Route('/api/events/{eventId}/budget/quote-vendors', name: 'budget_quote_vendors', methods: ['GET'])]
    #[InEvent(Permission::BudgetManage)]
    public function vendors(string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $quoted = Vec\map($this->engagementRepository->findOnEvent($event), static fn (VendorEngagement $engagement): string => $engagement->getVendor()->getId()->toRfc4122());
        $offered = Vec\sort(
            $this->vendorRepository->findBy(['organisation' => $event->getOrganisation(), 'archivedAt' => null]),
            static fn (Vendor $a, Vendor $b): int => Str\lowercase($a->getName()) <=> Str\lowercase($b->getName()),
        );

        return new JsonResponse(['vendors' => Vec\map($offered, static fn (Vendor $vendor): array => [
            ...QuoteSerialiser::vendor($vendor),
            'quoted' => Iter\contains($quoted, $vendor->getId()->toRfc4122()),
        ])]);
    }

    #[Route('/api/events/{eventId}/budget/quotes', name: 'budget_quotes_add', methods: ['POST'])]
    #[InEvent(Permission::BudgetManage, feature: PlanFeature::Vendors)]
    public function add(Request $request, string $eventId): JsonResponse
    {
        $event = $this->event($eventId);
        $engagement = $this->quoteEditor->add($event, Input::body($request, QuoteRules::sentQuote()), $this->user());

        return new JsonResponse(['quote' => $this->quoteSerialiser->one($event, $engagement)], Response::HTTP_CREATED);
    }

    /** A new amount or date quoted; refused 409 `quote_unchanged` when both are as they were. */
    #[Route('/api/events/{eventId}/budget/quotes/{quoteId}/revisions', name: 'budget_quotes_revise', methods: ['POST'])]
    #[InEvent(Permission::BudgetManage, feature: PlanFeature::Vendors)]
    public function revise(Request $request, #[InThisEvent('quoteId')] VendorEngagement $engagement): JsonResponse
    {
        $this->quoteEditor->revise($engagement, Input::body($request, QuoteRules::sentTerms()), $this->user());

        return new JsonResponse(['quote' => $this->quoteSerialiser->one($engagement->getEvent(), $engagement)], Response::HTTP_CREATED);
    }

    /** What it covers, its quote number and its budget lines, the whole set sent. */
    #[Route('/api/events/{eventId}/budget/quotes/{quoteId}', name: 'budget_quotes_correct', methods: ['PUT'])]
    #[InEvent(Permission::BudgetManage, feature: PlanFeature::Vendors)]
    public function correct(Request $request, #[InThisEvent('quoteId')] VendorEngagement $engagement): JsonResponse
    {
        $this->quoteEditor->correct($engagement, Input::body($request, QuoteRules::sentWording()), $this->user());

        return new JsonResponse(['quote' => $this->quoteSerialiser->one($engagement->getEvent(), $engagement)]);
    }

    #[Route('/api/events/{eventId}/budget/quotes/{quoteId}/payments', name: 'budget_payments_add', methods: ['POST'])]
    #[InEvent(Permission::BudgetManage, feature: PlanFeature::Vendors)]
    public function addPayment(Request $request, #[InThisEvent('quoteId')] VendorEngagement $engagement): JsonResponse
    {
        $this->quoteEditor->addPayment($engagement, Input::body($request, QuoteRules::sentPayment()), $this->user());

        return new JsonResponse(['quote' => $this->quoteSerialiser->one($engagement->getEvent(), $engagement)], Response::HTTP_CREATED);
    }

    /** A schedule started from a shape (sc-1332): every payment or none, refused 409 `payments_already_scheduled` once the vendor has any. */
    #[Route('/api/events/{eventId}/budget/quotes/{quoteId}/schedule', name: 'budget_schedule_add', methods: ['POST'])]
    #[InEvent(Permission::BudgetManage, feature: PlanFeature::Vendors)]
    public function addSchedule(Request $request, #[InThisEvent('quoteId')] VendorEngagement $engagement): JsonResponse
    {
        $this->quoteEditor->addSchedule($engagement, Input::body($request, QuoteRules::sentSchedule()), $this->user());

        return new JsonResponse(['quote' => $this->quoteSerialiser->one($engagement->getEvent(), $engagement)], Response::HTTP_CREATED);
    }

    #[Route('/api/events/{eventId}/budget/payments/{paymentId}', name: 'budget_payments_amend', methods: ['PUT'])]
    #[InEvent(Permission::BudgetManage, feature: PlanFeature::Vendors)]
    public function amendPayment(Request $request, #[InThisEvent('paymentId')] ScheduledPayment $payment): JsonResponse
    {
        $this->quoteEditor->amendPayment($payment, Input::body($request, QuoteRules::sentPayment()), $this->user());
        $engagement = $payment->getEngagement();

        return new JsonResponse(['quote' => $this->quoteSerialiser->one($engagement->getEvent(), $engagement)]);
    }

    #[Route('/api/events/{eventId}/budget/payments/{paymentId}', name: 'budget_payments_remove', methods: ['DELETE'])]
    #[InEvent(Permission::BudgetManage, feature: PlanFeature::Vendors)]
    public function removePayment(#[InThisEvent('paymentId')] ScheduledPayment $payment): Response
    {
        $this->quoteEditor->removePayment($payment, $this->user());

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /** A command, not a PATCH: the amount, the day and an optional reference, recorded with who marked it and when (sc-88). Refused 409 when already paid or cancelled. */
    #[Route('/api/events/{eventId}/budget/payments/{paymentId}/paid', name: 'budget_payments_mark_paid', methods: ['POST'])]
    #[InEvent(Permission::BudgetManage, feature: PlanFeature::Vendors)]
    public function markPaid(Request $request, #[InThisEvent('paymentId')] ScheduledPayment $payment): JsonResponse
    {
        $this->paymentEditor->markPaid($payment, Input::body($request, QuoteRules::sentPaid()), $this->user());

        return $this->engagement($payment->getEngagement());
    }

    /** Undo: unmarks a scheduled payment, and deletes one added as already paid. */
    #[Route('/api/events/{eventId}/budget/payments/{paymentId}/paid', name: 'budget_payments_undo_paid', methods: ['DELETE'])]
    #[InEvent(Permission::BudgetManage, feature: PlanFeature::Vendors)]
    public function undoPaid(#[InThisEvent('paymentId')] ScheduledPayment $payment): JsonResponse
    {
        $engagement = $payment->getEngagement();
        $this->paymentEditor->undo($payment, $this->user());

        return $this->engagement($engagement);
    }

    /** Not owed after all: kept, struck through, with an optional reason. Refused 409 when paid. */
    #[Route('/api/events/{eventId}/budget/payments/{paymentId}/cancellation', name: 'budget_payments_cancel', methods: ['POST'])]
    #[InEvent(Permission::BudgetManage, feature: PlanFeature::Vendors)]
    public function cancelPayment(Request $request, #[InThisEvent('paymentId')] ScheduledPayment $payment): JsonResponse
    {
        $this->paymentEditor->cancel($payment, Input::body($request, QuoteRules::sentCancellation()), $this->user());

        return $this->engagement($payment->getEngagement());
    }

    #[Route('/api/events/{eventId}/budget/payments/{paymentId}/cancellation', name: 'budget_payments_restore', methods: ['DELETE'])]
    #[InEvent(Permission::BudgetManage, feature: PlanFeature::Vendors)]
    public function restorePayment(#[InThisEvent('paymentId')] ScheduledPayment $payment): JsonResponse
    {
        $this->paymentEditor->restore($payment, $this->user());

        return $this->engagement($payment->getEngagement());
    }

    /** Add a payment already made: added to the vendor's schedule and marked paid in one action. */
    #[Route('/api/events/{eventId}/budget/quotes/{quoteId}/paid-payments', name: 'budget_payments_add_made', methods: ['POST'])]
    #[InEvent(Permission::BudgetManage, feature: PlanFeature::Vendors)]
    public function addMade(Request $request, #[InThisEvent('quoteId')] VendorEngagement $engagement): JsonResponse
    {
        $payment = $this->paymentEditor->addMade($engagement, Input::body($request, QuoteRules::sentMade()), $this->user());

        return new JsonResponse(['quote' => $this->quoteSerialiser->one($engagement->getEvent(), $engagement), 'paymentId' => $payment->getId()->toRfc4122()], Response::HTTP_CREATED);
    }

    private function engagement(VendorEngagement $engagement): JsonResponse
    {
        return new JsonResponse(['quote' => $this->quoteSerialiser->one($engagement->getEvent(), $engagement)]);
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
