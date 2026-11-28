<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Audit\Auditor;
use App\Domain\Budget\Model\QuoteWording;
use App\Domain\Budget\Reminder\PaymentReminders;
use App\Entity\BudgetLine;
use App\Entity\Event;
use App\Entity\Quote;
use App\Entity\ScheduledPayment;
use App\Entity\User;
use App\Entity\Vendor;
use App\Entity\VendorEngagement;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\BudgetLineRepository;
use App\Repository\QuoteRepository;
use App\Repository\ScheduledPaymentRepository;
use App\Repository\VendorEngagementRepository;
use App\Repository\VendorRepository;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use LogicException;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/**
 * @phpstan-import-type SentQuote from QuoteRules
 * @phpstan-import-type SentTerms from QuoteRules
 * @phpstan-import-type SentWording from QuoteRules
 * @phpstan-import-type SentPayment from QuoteRules
 * @phpstan-import-type SentSchedule from QuoteRules
 */
final readonly class QuoteEditor
{
    public const string ADDED = 'quote.added';

    public const string REVISED = 'quote.revised';

    public const string CORRECTED = 'quote.corrected';

    public const string PAYMENT_ADDED = 'scheduled_payment.added';

    public const string PAYMENT_AMENDED = 'scheduled_payment.amended';

    public const string PAYMENT_REMOVED = 'scheduled_payment.removed';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private VendorRepository $vendorRepository,
        private VendorEngagementRepository $engagementRepository,
        private QuoteRepository $quoteRepository,
        private ScheduledPaymentRepository $paymentRepository,
        private BudgetLineRepository $budgetLineRepository,
        private QuoteRules $quoteRules,
        private QuotePublisher $quotePublisher,
        private PaymentEditor $paymentEditor,
        private PaymentReminders $paymentReminders,
        private Auditor $auditor,
        private ClockInterface $clock,
    ) {
    }

    /** @param SentQuote $sent */
    public function add(Event $event, array $sent, User $by): VendorEngagement
    {
        try {
            $engagement = $this->locked($event, function () use ($event, $sent, $by): VendorEngagement {
                [$terms, $wording] = $this->quoteRules->quote($sent, $event);
                $vendor = $this->offered($event, $sent['vendorId'] ?? '');

                if (null !== $this->engagementRepository->findOf($event, $vendor)) {
                    throw self::alreadyQuoted();
                }

                $engagement = new VendorEngagement($event, $vendor);
                $this->entityManager->persist($engagement);
                $quote = new Quote($engagement, $wording->covers, $terms->amountMinor, $terms->quotedOn, $wording->reference);
                $this->entityManager->persist($quote);
                $this->agree($event, $engagement, $wording);
                $this->audit(self::ADDED, 'Quote', $quote->getId(), $by);

                return $engagement;
            });
        } catch (UniqueConstraintViolationException) {
            throw self::alreadyQuoted();
        }

        $this->quotePublisher->publish($event);

        return $engagement;
    }

    /** @param SentTerms $sent */
    public function revise(VendorEngagement $engagement, array $sent, User $by): void
    {
        $event = $engagement->getEvent();
        $this->locked($event, function () use ($event, $engagement, $sent, $by): VendorEngagement {
            $terms = $this->quoteRules->terms($sent, $event);
            $current = $this->current($engagement);

            if ($terms->amountMinor === $current->getAmountMinor() && $terms->quotedOn->format('Y-m-d') === $current->getQuotedOn()->format('Y-m-d')) {
                throw new ApiException(ErrorCode::QuoteUnchanged, 'quotes.revision_unchanged');
            }

            $current->supersede($this->clock->now());
            $this->entityManager->flush();
            $revised = new Quote($engagement, $current->getCovers(), $terms->amountMinor, $terms->quotedOn, $current->getReference());
            $this->entityManager->persist($revised);
            $this->audit(self::REVISED, 'Quote', $revised->getId(), $by);

            return $engagement;
        });
        $this->quotePublisher->publish($event);
    }

    /** @param SentWording $sent */
    public function correct(VendorEngagement $engagement, array $sent, User $by): void
    {
        $event = $engagement->getEvent();
        $this->locked($event, function () use ($event, $engagement, $sent, $by): VendorEngagement {
            $wording = $this->quoteRules->wording($sent);
            $current = $this->current($engagement);
            $current->correct($wording->covers, $wording->reference);
            $this->agree($event, $engagement, $wording);
            $this->audit(self::CORRECTED, 'Quote', $current->getId(), $by);

            return $engagement;
        });
        $this->quotePublisher->publish($event);
    }

    /** @param SentPayment $sent */
    public function addPayment(VendorEngagement $engagement, array $sent, User $by): ScheduledPayment
    {
        $event = $engagement->getEvent();
        $payment = null;
        $this->locked($event, function () use ($event, $engagement, $sent, $by, &$payment): VendorEngagement {
            $details = $this->quoteRules->payment($sent, $event, $this->current($engagement));
            $payment = new ScheduledPayment($engagement, $details->description, $details->amountMinor, $details->dueOn);
            $this->entityManager->persist($payment);
            $this->paymentReminders->follow($payment);
            $this->audit(self::PAYMENT_ADDED, 'ScheduledPayment', $payment->getId(), $by);

            return $engagement;
        });
        $this->quotePublisher->publish($event);

        return $payment ?? throw new LogicException('No payment was added.');
    }

    /**
     * A schedule's first payments, all or none (sc-1332): refused 409 `payments_already_scheduled` once the engagement has any payment not cancelled, so two people never both start one.
     *
     * @param SentSchedule $sent
     */
    public function addSchedule(VendorEngagement $engagement, array $sent, User $by): void
    {
        $event = $engagement->getEvent();
        $this->locked($event, function () use ($event, $engagement, $sent, $by): VendorEngagement {
            if ($this->paymentRepository->hasScheduled($engagement)) {
                throw new ApiException(ErrorCode::PaymentsAlreadyScheduled, 'quotes.payments_already_scheduled');
            }

            foreach ($this->quoteRules->schedule($sent, $event, $this->current($engagement)) as $details) {
                $payment = new ScheduledPayment($engagement, $details->description, $details->amountMinor, $details->dueOn);
                $this->entityManager->persist($payment);
                $this->paymentReminders->follow($payment);
                $this->audit(self::PAYMENT_ADDED, 'ScheduledPayment', $payment->getId(), $by);
            }

            return $engagement;
        });
        $this->quotePublisher->publish($event);
    }

    /** @param SentPayment $sent */
    public function amendPayment(ScheduledPayment $payment, array $sent, User $by): void
    {
        $engagement = $payment->getEngagement();
        $event = $engagement->getEvent();
        $this->locked($event, function () use ($event, $engagement, $payment, $sent, $by): VendorEngagement {
            $this->paymentEditor->refuseSettled($payment);
            $details = $this->quoteRules->payment($sent, $event, $this->current($engagement));
            $payment->amend($details->description, $details->amountMinor, $details->dueOn);
            $this->paymentReminders->follow($payment);
            $this->audit(self::PAYMENT_AMENDED, 'ScheduledPayment', $payment->getId(), $by);

            return $engagement;
        });
        $this->quotePublisher->publish($event);
    }

    public function removePayment(ScheduledPayment $payment, User $by): void
    {
        $engagement = $payment->getEngagement();
        $event = $engagement->getEvent();
        $this->locked($event, function () use ($engagement, $payment, $by): VendorEngagement {
            $this->paymentEditor->refuseSettled($payment);
            $this->audit(self::PAYMENT_REMOVED, 'ScheduledPayment', $payment->getId(), $by);
            $this->paymentReminders->forget($payment->getId());
            $this->entityManager->remove($payment);

            return $engagement;
        });
        $this->quotePublisher->publish($event);
    }

    /** An archived vendor, another organisation's or an id that is not one all read alike, and never echo a name back. */
    private function offered(Event $event, string $vendorId): Vendor
    {
        $vendor = Uuid::isValid($vendorId) ? $this->vendorRepository->findOneInOrganisation($event->getOrganisation(), $vendorId) : null;

        if (null === $vendor || null !== $vendor->getArchivedAt()) {
            throw ApiException::validation([$this->quoteRules->vendorGone()]);
        }

        return $vendor;
    }

    /** The lines ticked are agreed in this quote, and any it agreed before and no longer lists go back to estimated. */
    private function agree(Event $event, VendorEngagement $engagement, QuoteWording $wording): void
    {
        $onEvent = $this->budgetLineRepository->findOnEvent($event);
        $ticked = Vec\unique($wording->lineIds);

        foreach ($ticked as $lineId) {
            $line = Vec\filter($onEvent, static fn (BudgetLine $one): bool => $one->getId()->toRfc4122() === $lineId)[0] ?? throw ApiException::notFound('access.not_found');
            $agreedIn = $line->getAgreedIn();

            if (null !== $agreedIn && $agreedIn !== $engagement) {
                throw ApiException::validation([$this->quoteRules->lineAgreed($line->getLabel(), $agreedIn->getVendor()->getName())]);
            }

            $line->agreeIn($engagement);
        }

        foreach ($onEvent as $line) {
            if ($line->getAgreedIn() === $engagement && !Iter\contains($ticked, $line->getId()->toRfc4122())) {
                $line->agreeIn(null);
            }
        }
    }

    private function current(VendorEngagement $engagement): Quote
    {
        return $this->quoteRepository->findCurrent($engagement) ?? throw new LogicException('An engagement with no current quote.');
    }

    /** @param callable(): VendorEngagement $write */
    private function locked(Event $event, callable $write): VendorEngagement
    {
        return $this->entityManager->wrapInTransaction(function () use ($event, $write): VendorEngagement {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $engagement = $write();
            $this->entityManager->flush();

            return $engagement;
        });
    }

    private static function alreadyQuoted(): ApiException
    {
        return new ApiException(ErrorCode::VendorAlreadyQuoted, 'quotes.vendor_already_quoted');
    }

    private function audit(string $action, string $type, Uuid $id, User $by): void
    {
        $this->auditor->record($action, $type, $id, Actor::User, $by->getId(), $by->getName());
    }
}
