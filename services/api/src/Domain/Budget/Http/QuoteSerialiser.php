<?php

declare(strict_types=1);

namespace App\Domain\Budget\Http;

use App\Entity\BudgetLine;
use App\Entity\Event;
use App\Entity\Quote;
use App\Entity\ScheduledPayment;
use App\Entity\Vendor;
use App\Entity\VendorEngagement;
use App\Enum\PlanFeature;
use App\Http\Access\Interfaces\PlanFeaturesInterface;
use App\Locale\Money;
use App\Repository\BudgetLineRepository;
use App\Repository\QuoteRepository;
use App\Repository\ScheduledPaymentRepository;
use App\Repository\VendorEngagementRepository;
use DateTimeImmutable;
use DateTimeZone;
use LogicException;
use Psl\Dict;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/**
 * An event's quotes and schedules as everyone holding budget.read sees them (sc-87). A vendor carries its name, category and contact name, never more of its record: an event's Lead reads this without vendors.read.
 *
 * @phpstan-type Chosen array{id: string, name: string, category: string, contactName: ?string, archived: bool}
 * @phpstan-type Version array{id: string, covers: string, amount: string, quotedOn: string, reference: ?string, supersededAt: ?string}
 * @phpstan-type Payment array{id: string, description: string, amount: string, dueOn: string, overdue: bool}
 * @phpstan-type Engaged array{id: string, vendor: Chosen, quote: Version, earlier: list<Version>, lines: list<array{id: string, label: string}>, payments: list<Payment>, scheduled: string, difference: string}
 * @phpstan-type Due array{id: string, quoteId: string, vendor: string, description: string, amount: string, dueOn: string, overdue: bool}
 * @phpstan-type Quotes array{currency: string, timeZone: string, entitled: bool, quotes: list<Engaged>, due: list<Due>}
 */
final readonly class QuoteSerialiser
{
    public function __construct(
        private VendorEngagementRepository $engagementRepository,
        private QuoteRepository $quoteRepository,
        private ScheduledPaymentRepository $paymentRepository,
        private BudgetLineRepository $budgetLineRepository,
        private PlanFeaturesInterface $planFeatures,
        private ClockInterface $clock,
    ) {
    }

    /** @return Quotes */
    public function list(Event $event): array
    {
        $currency = $event->getCurrency();
        $today = $this->clock->now()->setTimezone(new DateTimeZone($event->getTimeZone()))->format('Y-m-d');
        $versions = Dict\group_by($this->quoteRepository->findOnEvent($event), static fn (Quote $quote): string => $quote->getEngagement()->getId()->toRfc4122());
        $payments = Dict\group_by($this->paymentRepository->findOnEvent($event), static fn (ScheduledPayment $payment): string => $payment->getEngagement()->getId()->toRfc4122());
        $lines = Dict\group_by(
            Vec\filter($this->budgetLineRepository->findOnEvent($event), static fn (BudgetLine $line): bool => null !== $line->getAgreedIn()),
            static fn (BudgetLine $line): string => $line->getAgreedIn()?->getId()->toRfc4122() ?? '',
        );
        $quotes = [];
        $due = [];

        foreach ($this->engagementRepository->findOnEvent($event) as $engagement) {
            $id = $engagement->getId()->toRfc4122();
            $all = $versions[$id] ?? [];
            $current = Vec\filter($all, static fn (Quote $quote): bool => null === $quote->getSupersededAt())[0] ?? null;

            if (null === $current) {
                continue;
            }

            $owed = $payments[$id] ?? [];
            $scheduledMinor = 0;

            foreach ($owed as $payment) {
                $scheduledMinor += $payment->getAmountMinor();
                $due[] = [
                    'id' => $payment->getId()->toRfc4122(),
                    'quoteId' => $id,
                    'vendor' => $engagement->getVendor()->getName(),
                    'description' => $payment->getDescription(),
                    'amount' => Money::written($payment->getAmountMinor(), $currency),
                    'dueOn' => $payment->getDueOn()->format('Y-m-d'),
                    'overdue' => $payment->getDueOn()->format('Y-m-d') < $today,
                ];
            }

            $quotes[] = [
                'id' => $id,
                'vendor' => self::vendor($engagement->getVendor()),
                'quote' => self::version($current, $currency),
                'earlier' => Vec\map(Vec\filter($all, static fn (Quote $quote): bool => $quote !== $current), static fn (Quote $quote): array => self::version($quote, $currency)),
                'lines' => Vec\map($lines[$id] ?? [], static fn (BudgetLine $line): array => ['id' => $line->getId()->toRfc4122(), 'label' => $line->getLabel()]),
                'payments' => Vec\map($owed, static fn (ScheduledPayment $payment): array => self::payment($payment, $currency, $today)),
                'scheduled' => Money::written($scheduledMinor, $currency),
                'difference' => Money::written($scheduledMinor - $current->getAmountMinor(), $currency),
            ];
        }

        return [
            'currency' => $currency,
            'timeZone' => $event->getTimeZone(),
            'entitled' => $this->planFeatures->unlocks($event->getOrganisation()->getId(), PlanFeature::Vendors),
            'quotes' => $quotes,
            'due' => Vec\sort($due, static fn (array $a, array $b): int => [$a['dueOn'], Str\lowercase($a['vendor'])] <=> [$b['dueOn'], Str\lowercase($b['vendor'])]),
        ];
    }

    /** @return Engaged */
    public function one(Event $event, VendorEngagement $engagement): array
    {
        foreach ($this->list($event)['quotes'] as $quote) {
            if ($quote['id'] === $engagement->getId()->toRfc4122()) {
                return $quote;
            }
        }

        throw new LogicException('An engagement with no current quote.');
    }

    /** @return Chosen */
    public static function vendor(Vendor $vendor): array
    {
        return [
            'id' => $vendor->getId()->toRfc4122(),
            'name' => $vendor->getName(),
            'category' => $vendor->getCategory()->value,
            'contactName' => $vendor->getContactName(),
            'archived' => null !== $vendor->getArchivedAt(),
        ];
    }

    /** @return Version */
    private static function version(Quote $quote, string $currency): array
    {
        return [
            'id' => $quote->getId()->toRfc4122(),
            'covers' => $quote->getCovers(),
            'amount' => Money::written($quote->getAmountMinor(), $currency),
            'quotedOn' => $quote->getQuotedOn()->format('Y-m-d'),
            'reference' => $quote->getReference(),
            'supersededAt' => $quote->getSupersededAt()?->format(DateTimeImmutable::ATOM),
        ];
    }

    /** @return Payment */
    private static function payment(ScheduledPayment $payment, string $currency, string $today): array
    {
        return [
            'id' => $payment->getId()->toRfc4122(),
            'description' => $payment->getDescription(),
            'amount' => Money::written($payment->getAmountMinor(), $currency),
            'dueOn' => $payment->getDueOn()->format('Y-m-d'),
            'overdue' => $payment->getDueOn()->format('Y-m-d') < $today,
        ];
    }
}
