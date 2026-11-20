<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Audit\Auditor;
use App\Entity\ScheduledPayment;
use App\Entity\User;
use App\Entity\VendorEngagement;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\Money;
use App\Repository\QuoteRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use LogicException;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * @phpstan-import-type SentPaid from QuoteRules
 * @phpstan-import-type SentMade from QuoteRules
 * @phpstan-import-type SentCancellation from QuoteRules
 */
final readonly class PaymentEditor
{
    public const string MARKED_PAID = 'scheduled_payment.marked_paid';

    public const string UNMARKED = 'scheduled_payment.unmarked';

    public const string CANCELLED = 'scheduled_payment.cancelled';

    public const string RESTORED = 'scheduled_payment.restored';

    public const string ADDED_AS_PAID = 'scheduled_payment.added_as_paid';

    public const string DELETED = 'scheduled_payment.deleted';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private QuoteRepository $quoteRepository,
        private QuoteRules $quoteRules,
        private QuotePublisher $quotePublisher,
        private Auditor $auditor,
        private ClockInterface $clock,
        private TranslatorInterface $translator,
    ) {
    }

    /** @param SentPaid $sent */
    public function markPaid(ScheduledPayment $payment, array $sent, User $by): void
    {
        $this->locked($payment, function () use ($payment, $sent, $by): void {
            $this->refuseSettled($payment);
            $details = $this->quoteRules->paid($sent, $payment->getEngagement()->getEvent());
            $before = self::recorded($payment);
            $payment->markPaid($details->amountMinor, $details->paidOn, $details->reference, $this->clock->now(), $by);
            $this->audit(self::MARKED_PAID, $payment, $by, $before);
        });
    }

    /** One added as already paid is deleted, since the plan never owed it. */
    public function undo(ScheduledPayment $payment, User $by): void
    {
        $this->locked($payment, function () use ($payment, $by): void {
            if (!$payment->isPaid()) {
                return;
            }

            $before = self::recorded($payment);

            if ($payment->isAddedAsPaid()) {
                $this->auditor->record(self::DELETED, 'ScheduledPayment', $payment->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff($before, []));
                $this->entityManager->remove($payment);

                return;
            }

            $payment->unmark();
            $this->audit(self::UNMARKED, $payment, $by, $before);
        });
    }

    /** @param SentCancellation $sent */
    public function cancel(ScheduledPayment $payment, array $sent, User $by): void
    {
        $this->locked($payment, function () use ($payment, $sent, $by): void {
            if ($payment->isCancelled()) {
                return;
            }

            $this->refuseSettled($payment);
            $before = self::recorded($payment);
            $payment->cancel($this->quoteRules->reason($sent), $this->clock->now(), $by);
            $this->audit(self::CANCELLED, $payment, $by, $before);
        });
    }

    public function restore(ScheduledPayment $payment, User $by): void
    {
        $this->locked($payment, function () use ($payment, $by): void {
            if (!$payment->isCancelled()) {
                return;
            }

            $before = self::recorded($payment);
            $payment->restore();
            $this->audit(self::RESTORED, $payment, $by, $before);
        });
    }

    /** @param SentMade $sent */
    public function addMade(VendorEngagement $engagement, array $sent, User $by): ScheduledPayment
    {
        $event = $engagement->getEvent();
        $payment = $this->entityManager->wrapInTransaction(function () use ($event, $engagement, $sent, $by): ScheduledPayment {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $first = $this->quoteRepository->findFirst($engagement) ?? throw new LogicException('An engagement with no quote.');
            [$description, $details] = $this->quoteRules->made($sent, $event, $first);
            $payment = new ScheduledPayment($engagement, $description, $details->amountMinor, $details->paidOn);
            $payment->markPaid($details->amountMinor, $details->paidOn, $details->reference, $this->clock->now(), $by);
            $payment->addedAsPaid();
            $this->entityManager->persist($payment);
            $this->audit(self::ADDED_AS_PAID, $payment, $by, []);
            $this->entityManager->flush();

            return $payment;
        });
        $this->quotePublisher->publish($event);

        return $payment;
    }

    public function refuseSettled(ScheduledPayment $payment): void
    {
        if ($payment->isPaid()) {
            $name = $payment->getPaidBy()?->getName();

            throw new ApiException(ErrorCode::PaymentAlreadyPaid, null === $name || '' === $name
                ? $this->translator->trans('payments.already_paid')
                : $this->translator->trans('payments.already_paid_by', ['{name}' => $name]));
        }

        if ($payment->isCancelled()) {
            throw new ApiException(ErrorCode::PaymentCancelled, $this->translator->trans('payments.cancelled'));
        }
    }

    /** @param callable(): void $write */
    private function locked(ScheduledPayment $payment, callable $write): void
    {
        $event = $payment->getEngagement()->getEvent();
        $this->entityManager->wrapInTransaction(function () use ($event, $payment, $write): void {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $this->entityManager->refresh($payment);
            $write();
            $this->entityManager->flush();
        });
        $this->quotePublisher->publish($event);
    }

    /** @param array<string, ?string> $before */
    private function audit(string $action, ScheduledPayment $payment, User $by, array $before): void
    {
        $this->auditor->record($action, 'ScheduledPayment', $payment->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff($before, self::recorded($payment)));
    }

    /** @return array<string, ?string> */
    private static function recorded(ScheduledPayment $payment): array
    {
        $currency = $payment->getEngagement()->getEvent()->getCurrency();
        $paid = $payment->getPaidAmountMinor();

        return [
            'vendor' => $payment->getEngagement()->getVendor()->getName(),
            'description' => $payment->getDescription(),
            'amount' => Money::written($payment->getAmountMinor(), $currency),
            'dueOn' => $payment->getDueOn()->format('Y-m-d'),
            'paidAmount' => null === $paid ? null : Money::written($paid, $currency),
            'paidOn' => $payment->getPaidOn()?->format('Y-m-d'),
            'reference' => $payment->getPaidReference(),
            'paidBy' => $payment->getPaidBy()?->getName(),
            'cancelReason' => $payment->getCancelReason(),
            'cancelledBy' => $payment->getCancelledBy()?->getName(),
        ];
    }
}
