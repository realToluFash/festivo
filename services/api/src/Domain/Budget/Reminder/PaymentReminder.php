<?php

declare(strict_types=1);

namespace App\Domain\Budget\Reminder;

use App\Domain\Messaging\Interfaces\NotificationTypeInterface;
use App\Domain\Messaging\Model\EventTimes;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Entity\ScheduledPayment;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\NotificationEventRule;
use App\Enum\NotificationPriority;
use App\Enum\PlanFeature;
use App\Http\Access\Interfaces\PlanFeaturesInterface;
use App\Locale\Money;
use App\Locale\SupportedLocales;
use App\Repository\ScheduledPaymentRepository;
use DateTimeImmutable;
use IntlDateFormatter;
use IntlDatePatternGenerator;
use LogicException;
use NumberFormatter;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** sc-95: one message a day for everything due, to whoever can mark it paid on each payment's event; overdue first, each the last about its payment. */
final readonly class PaymentReminder implements NotificationTypeInterface
{
    public const string NAME = 'budget.payment_reminder';

    public const string COLLAPSE_KEY = 'payment-reminders';

    public function __construct(
        private ScheduledPaymentRepository $scheduledPaymentRepository,
        private PlanFeaturesInterface $planFeatures,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
        #[Autowire(env: 'CORS_WEB_ORIGIN')]
        private string $webOrigin,
    ) {
    }

    public function name(): string
    {
        return self::NAME;
    }

    public function audienceKind(): NotificationAudienceKind
    {
        return NotificationAudienceKind::Member;
    }

    public function category(): NotificationCategory
    {
        return NotificationCategory::Money;
    }

    public function priority(): NotificationPriority
    {
        return NotificationPriority::Normal;
    }

    public function channels(): array
    {
        return [NotificationChannel::InApp, NotificationChannel::Push, NotificationChannel::Email];
    }

    /** Waits while the event is paused, sends nothing once it is deleted or called off, and goes on after it has ended: balances fall due after events. */
    public function eventRule(): NotificationEventRule
    {
        return NotificationEventRule::AfterConclusion;
    }

    public function canBeSwitchedOff(): bool
    {
        return true;
    }

    public function tooLateAt(DateTimeImmutable $dueAt, ?EventTimes $event): ?DateTimeImmutable
    {
        return null;
    }

    public function carriesCode(): bool
    {
        return false;
    }

    public function supersedesEarlier(): bool
    {
        return false;
    }

    public function reachesSuppressed(): bool
    {
        return false;
    }

    public function collapseKey(array $payload): ?string
    {
        return self::COLLAPSE_KEY;
    }

    /** Still owed, on a plan that has payment schedules; a coming-due one whose date has passed is left to the overdue one. */
    public function isStillDue(array $payload, ?Uuid $recipient = null): bool
    {
        $payment = $this->payment($payload);

        if (null === $payment || $payment->isPaid() || $payment->isCancelled()) {
            return false;
        }

        $event = $payment->getEngagement()->getEvent();

        if (!$this->planFeatures->unlocks($event->getOrganisation()->getId(), PlanFeature::Vendors)) {
            return false;
        }

        return PaymentReminders::OVERDUE === self::kind($payload)
            || PaymentReminders::today($event, $this->clock->now()) <= $payment->getDueOn()->format('Y-m-d');
    }

    public function thread(array $payload): ?string
    {
        return null;
    }

    public function render(NotificationChannel $channel, Recipient $recipient, array $payloads): RenderedNotification
    {
        $locale = $recipient->locale;
        $kinds = [];

        foreach ($payloads as $payload) {
            $id = self::paymentId($payload);
            $kinds[$id] = PaymentReminders::OVERDUE === ($kinds[$id] ?? null) ? PaymentReminders::OVERDUE : self::kind($payload);
        }

        $payments = Vec\sort(
            Vec\filter_nulls(Vec\map(Vec\keys($kinds), fn (string $id): ?ScheduledPayment => $this->scheduledPaymentRepository->find($id))),
            static fn (ScheduledPayment $a, ScheduledPayment $b): int => [PaymentReminders::OVERDUE !== $kinds[$a->getId()->toRfc4122()], $a->getDueOn(), $a->getId()->toRfc4122()]
                <=> [PaymentReminders::OVERDUE !== $kinds[$b->getId()->toRfc4122()], $b->getDueOn(), $b->getId()->toRfc4122()],
        );

        if ([] === $payments) {
            throw new LogicException('A payment reminder rendered with none of its payments left.');
        }

        $overdue = Vec\filter($payments, static fn (ScheduledPayment $payment): bool => PaymentReminders::OVERDUE === $kinds[$payment->getId()->toRfc4122()]);
        $events = Vec\unique(Vec\map($payments, static fn (ScheduledPayment $payment): string => $payment->getEngagement()->getEvent()->getId()->toRfc4122()));
        $oneEvent = 1 === Iter\count($events) ? $payments[0]->getEngagement()->getEvent() : null;
        $days = $payments[0]->getEngagement()->getEvent()->getOrganisation()->getPaymentReminderDays();
        $comingCount = Iter\count($payments) - Iter\count($overdue);
        $overdueCount = Iter\count($overdue);

        $title = match (true) {
            0 === $comingCount => $this->trans(null === $oneEvent ? 'payment_reminder.title.overdue' : 'payment_reminder.title.overdue_on', ['count' => $overdueCount, 'events' => Iter\count($events), 'event' => $oneEvent?->getName() ?? ''], $locale),
            0 === $overdueCount => $this->trans(null === $oneEvent ? 'payment_reminder.title.coming_due' : 'payment_reminder.title.coming_due_on', ['count' => $comingCount, 'days' => $days, 'events' => Iter\count($events), 'event' => $oneEvent?->getName() ?? ''], $locale),
            default => $this->trans('payment_reminder.title.mixed', ['overdue' => $overdueCount, 'count' => $comingCount, 'days' => $days], $locale),
        };

        $short = NotificationChannel::Push !== $channel && null !== $oneEvent && (0 === $comingCount || 0 === $overdueCount);

        $lines = Vec\map($payments, function (ScheduledPayment $payment) use ($kinds, $short, $locale): string {
            $late = PaymentReminders::OVERDUE === $kinds[$payment->getId()->toRfc4122()];
            $event = $payment->getEngagement()->getEvent();
            $date = self::date($payment->getDueOn(), $locale);
            $row = $this->trans($short ? 'payment_reminder.row' : 'payment_reminder.row_on', [
                'vendor' => $payment->getEngagement()->getVendor()->getName(),
                'event' => $event->getName(),
                'amount' => self::money($payment->getAmountMinor(), $event->getCurrency(), $locale),
                'when' => $this->trans($late ? 'payment_reminder.was_due' : 'payment_reminder.due', ['date' => $date], $locale),
            ], $locale);

            return $late ? $this->trans('payment_reminder.overdue_row', ['row' => $row], $locale) : $row;
        });

        if (0 < $comingCount && 1 === $overdueCount) {
            $lines[] = $this->trans('payment_reminder.last_about', [
                'what' => $overdue[0]->getDescription(),
                'vendor' => $overdue[0]->getEngagement()->getVendor()->getName(),
            ], $locale);
        }

        if (NotificationChannel::Email === $channel) {
            return new RenderedNotification($title, $this->email($title, $lines, $payments, $locale));
        }

        return new RenderedNotification($title, Str\join($lines, "\n"), $lines, self::place($payments));
    }

    /**
     * @param list<string>                     $lines
     * @param non-empty-list<ScheduledPayment> $payments
     */
    private function email(string $title, array $lines, array $payments, string $locale): string
    {
        $origin = Str\trim_right($this->webOrigin, '/');
        $open = self::oneVendor($payments)
            ? $this->trans('payment_reminder.email.open_payments', ['count' => Iter\count($payments)], $locale)
            : $this->trans('payment_reminder.email.open_budget', [], $locale);

        return Str\join([
            $title,
            '',
            ...$lines,
            '',
            $this->trans('payment_reminder.email.link', ['label' => $open, 'url' => $origin . self::place($payments)], $locale),
            '',
            $this->trans('payment_reminder.email.footer', ['organisation' => $payments[0]->getEngagement()->getEvent()->getOrganisation()->getName()], $locale),
            $this->trans('payment_reminder.email.link', ['label' => $this->trans('payment_reminder.email.settings', [], $locale), 'url' => $origin . '/app/account/notifications'], $locale),
        ], "\n");
    }

    /** @param non-empty-list<ScheduledPayment> $payments one vendor's open its page, otherwise the first event's budget */
    private static function place(array $payments): string
    {
        $first = $payments[0]->getEngagement();
        $eventId = $first->getEvent()->getId()->toRfc4122();

        return self::oneVendor($payments)
            ? Str\format('/app/events/%s/budget/vendors/%s', $eventId, $first->getVendor()->getId()->toRfc4122())
            : Str\format('/app/events/%s/budget', $eventId);
    }

    /** @param non-empty-list<ScheduledPayment> $payments */
    private static function oneVendor(array $payments): bool
    {
        return 1 === Iter\count(Vec\unique(Vec\map($payments, static fn (ScheduledPayment $payment): string => $payment->getEngagement()->getId()->toRfc4122())));
    }

    private static function date(DateTimeImmutable $day, string $locale): string
    {
        $dates = SupportedLocales::dates($locale);
        $pattern = new IntlDatePatternGenerator($dates)->getBestPattern('EEEdMMM');
        $formatter = IntlDateFormatter::create($dates, IntlDateFormatter::NONE, IntlDateFormatter::NONE, 'UTC', null, false === $pattern ? 'EEE d MMM' : $pattern);

        return $formatter?->format(new DateTimeImmutable($day->format('Y-m-d') . 'T12:00:00Z')) ?: $day->format('Y-m-d');
    }

    private static function money(int $minor, string $currency, string $locale): string
    {
        $digits = Money::minorDigits($currency);
        $formatter = new NumberFormatter(SupportedLocales::dates($locale), NumberFormatter::CURRENCY);
        $formatter->setAttribute(NumberFormatter::MIN_FRACTION_DIGITS, $digits);
        $formatter->setAttribute(NumberFormatter::MAX_FRACTION_DIGITS, $digits);

        return $formatter->formatCurrency($minor / 10 ** $digits, $currency) ?: Money::written($minor, $currency) . ' ' . $currency;
    }

    /** @param array<string, mixed> $parameters */
    private function trans(string $key, array $parameters, string $locale): string
    {
        return $this->translator->trans($key, $parameters, 'messages', $locale);
    }

    /** @param array<string, mixed> $payload */
    private function payment(array $payload): ?ScheduledPayment
    {
        $id = self::paymentId($payload);

        return Uuid::isValid($id) ? $this->scheduledPaymentRepository->find($id) : null;
    }

    private static function paymentId(mixed $payload): string
    {
        return Type\shape(['paymentId' => Type\string()], true)->coerce($payload)['paymentId'];
    }

    private static function kind(mixed $payload): string
    {
        return Type\shape(['kind' => Type\string()], true)->coerce($payload)['kind'];
    }
}
