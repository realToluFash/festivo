<?php

declare(strict_types=1);

namespace App\Domain\Budget\Http;

use App\Domain\Billing\Entitlements;
use App\Domain\Budget\BudgetRange;
use App\Domain\Budget\Model\PayerShare;
use App\Domain\Budget\Model\SplitLine;
use App\Domain\Budget\Model\SplitPiece;
use App\Domain\Budget\PayerShares;
use App\Domain\Budget\QuantityResolver;
use App\Entity\Event;
use App\Entity\Payer;
use App\Entity\PayerPart;
use App\Entity\ScheduledPayment;
use App\Enum\PayerSplit;
use App\Enum\PlanFeature;
use App\Locale\Money;
use App\Repository\BudgetLineRepository;
use App\Repository\PayerPartRepository;
use App\Repository\PayerRepository;
use App\Repository\ScheduledPaymentRepository;
use BcMath\Number;
use Psl\Iter;
use Psl\Math;
use Psl\Str;
use Psl\Vec;

/** Who is paying (sc-91), worked out on every read. */
final readonly class PayersSerialiser
{
    public function __construct(
        private BudgetLineRepository $budgetLineRepository,
        private PayerRepository $payerRepository,
        private PayerPartRepository $payerPartRepository,
        private ScheduledPaymentRepository $scheduledPaymentRepository,
        private QuantityResolver $quantityResolver,
        private Entitlements $entitlements,
    ) {
    }

    /** @return array<string, mixed> */
    public function payers(Event $event): array
    {
        $currency = $event->getCurrency();
        $money = static fn (Number $minor): string => Money::written($minor, $currency);
        $range = static fn (Number $low, Number $high): array => ['confirmed' => $money($low), 'potential' => $money($high)];
        $budget = BudgetRange::of($this->budgetLineRepository->findOnEvent($event), $this->quantityResolver->factsFor($event));
        $payments = $this->scheduledPaymentRepository->findOnEvent($event);
        $shares = PayerShares::of($budget, $this->payerRepository->findOnEvent($event), $this->payerPartRepository->findOnEvent($event), $payments);
        $paidShown = $this->entitlements->of($event->getOrganisation()->getId())->unlocks(PlanFeature::Vendors)
            || Iter\any($payments, static fn (ScheduledPayment $payment): bool => null !== $payment->getPaidAmountMinor() && !$payment->isCancelled());
        $sum = static fn (array $lines, bool $potential): Number => PayerShares::sum(Vec\map($lines, static fn (SplitLine $line): Number => $potential ? $line->cost->potentialMinor : $line->cost->confirmedMinor));
        $with = $shares->withPayer();
        $without = $shares->withNoPayer();
        $next = $shares->next();

        return [
            'currency' => $currency,
            'paidShown' => $paidShown,
            'total' => $range($budget->confirmedMinor, $budget->potentialMinor),
            'hasPayer' => $range($sum($with, false), $sum($with, true)),
            'noPayer' => [...$range($sum($without, false), $sum($without, true)), 'costs' => Iter\count($without), 'paid' => $money($shares->noPayerPaidMinor)],
            'next' => null === $next ? null : ['id' => $next->cost->line->getId()->toRfc4122(), 'label' => $next->cost->line->getLabel()],
            'payers' => Vec\map($shares->payers, static function (PayerShare $share) use ($money, $range, $paidShown): array {
                $still = static fn (Number $end): Number => $end->compare($share->paidMinor) > 0 ? $end->sub($share->paidMinor) : new Number(0);

                return [
                    ...self::payer($share->payer),
                    'share' => $range($share->confirmedMinor, $share->potentialMinor),
                    'notPriced' => Iter\count(Vec\filter($share->covers, static fn (SplitPiece $piece): bool => $piece->line->isNotPriced())),
                    'paid' => $paidShown ? $money($share->paidMinor) : null,
                    'stillToCome' => $paidShown ? $range($still($share->confirmedMinor), $still($share->potentialMinor)) : null,
                    'covers' => Vec\map($share->covers, static fn (SplitPiece $piece): array => [
                        'lineId' => $piece->line->cost->line->getId()->toRfc4122(),
                        'label' => $piece->line->cost->line->getLabel(),
                        'notPriced' => $piece->line->isNotPriced(),
                        'part' => $range($piece->confirmedMinor, $piece->potentialMinor),
                        'how' => self::how($piece, $money),
                    ]),
                ];
            }),
            'lines' => Vec\map($shares->lines, static fn (SplitLine $line): array => [
                'id' => $line->cost->line->getId()->toRfc4122(),
                'label' => $line->cost->line->getLabel(),
                'category' => $line->cost->line->getCategory()->value,
                'cost' => $range($line->cost->confirmedMinor, $line->cost->potentialMinor),
                'notPriced' => $line->isNotPriced(),
                'flagged' => $line->flagged,
                'split' => self::split($line, $money),
            ]),
        ];
    }

    /** @return array{id: string, name: string, note: ?string} */
    public static function payer(Payer $payer): array
    {
        return ['id' => $payer->getId()->toRfc4122(), 'name' => $payer->getName(), 'note' => $payer->getNote()];
    }

    /** @param callable(Number): string $money */
    private static function how(SplitPiece $piece, callable $money): array
    {
        if ($piece->rest) {
            return ['mode' => 'rest', 'after' => Vec\map($piece->line->parts, static fn (PayerPart $part): array => ['payerId' => $part->getPayer()->getId()->toRfc4122(), 'amount' => $money(new Number($part->getValue()))])];
        }

        return match ($piece->line->split) {
            PayerSplit::Percent => ['mode' => 'percent', 'percent' => self::percent((int) $piece->value)],
            PayerSplit::Fixed => ['mode' => 'fixed', 'amount' => $money(new Number((int) $piece->value))],
            default => ['mode' => 'one'],
        };
    }

    /** @param callable(Number): string $money */
    private static function split(SplitLine $line, callable $money): ?array
    {
        $id = static fn (PayerPart $part): string => $part->getPayer()->getId()->toRfc4122();

        return match ($line->split) {
            null => null,
            PayerSplit::One => ['mode' => 'one', 'payerId' => $id($line->parts[0])],
            PayerSplit::Percent => ['mode' => 'percent', 'shares' => Vec\map($line->parts, static fn (PayerPart $part): array => ['payerId' => $id($part), 'percent' => self::percent($part->getValue())])],
            PayerSplit::Fixed => [
                'mode' => 'fixed',
                'amounts' => Vec\map($line->parts, static fn (PayerPart $part): array => ['payerId' => $id($part), 'amount' => $money(new Number($part->getValue()))]),
                'restId' => $line->rest?->getId()->toRfc4122(),
            ],
        };
    }

    private static function percent(int $hundredths): string
    {
        return Str\format('%d.%02d', Math\div($hundredths, 100), $hundredths % 100);
    }
}
