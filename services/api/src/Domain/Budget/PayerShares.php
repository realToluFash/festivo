<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\LineCost;
use App\Domain\Budget\Model\PayerShare;
use App\Domain\Budget\Model\SplitLine;
use App\Domain\Budget\Model\SplitPiece;
use App\Entity\BudgetLine;
use App\Entity\Payer;
use App\Entity\PayerPart;
use App\Entity\ScheduledPayment;
use App\Enum\CostCategory;
use App\Enum\PayerSplit;
use BcMath\Number;
use LogicException;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/** Who is paying, worked out on every read from the range (sc-84), the splits and the payments marked paid (sc-88): never stored, so a reply or a new rate re-splits every proportional cost by itself. */
final readonly class PayerShares
{
    /** Hundredths of a percent: 100.00% is all of it. */
    public const int WHOLE = 10000;

    /**
     * @param list<SplitLine>  $lines  in the budget's order
     * @param list<PayerShare> $payers in the order they were added
     */
    private function __construct(
        public array $lines,
        public array $payers,
        public Number $noPayerPaidMinor,
    ) {
    }

    /**
     * @param list<Payer>            $payers   the event's, in the order they were added
     * @param list<PayerPart>        $parts
     * @param list<ScheduledPayment> $payments
     */
    public static function of(BudgetRange $range, array $payers, array $parts, array $payments): self
    {
        $place = Dict\flip(Vec\map($payers, static fn (Payer $payer): string => $payer->getId()->toRfc4122()));
        $shares = Dict\map($place, static fn (int $index): PayerShare => new PayerShare($payers[$index]));
        $byLine = Dict\group_by($parts, static fn (PayerPart $part): string => $part->getLine()->getId()->toRfc4122());
        $costs = Vec\sort($range->lines, static fn (LineCost $a, LineCost $b): int => self::categoryOrder($a->line) <=> self::categoryOrder($b->line));
        $lines = [];

        foreach ($costs as $cost) {
            $split = $cost->line->getPayerSplit();
            $own = Vec\sort(
                Vec\filter($byLine[$cost->line->getId()->toRfc4122()] ?? [], static fn (PayerPart $part): bool => isset($place[$part->getPayer()->getId()->toRfc4122()])),
                static fn (PayerPart $a, PayerPart $b): int => $place[$a->getPayer()->getId()->toRfc4122()] <=> $place[$b->getPayer()->getId()->toRfc4122()],
            );
            $rest = $cost->line->getRestPayer();

            if (null !== $split && ([] === $own || (PayerSplit::Fixed === $split && (null === $rest || !isset($place[$rest->getId()->toRfc4122()]))))) {
                $split = null;
            }

            $fixed = self::sum(Vec\map($own, static fn (PayerPart $part): Number => new Number($part->getValue())));
            $line = new SplitLine($cost, $split, null === $split ? [] : $own, PayerSplit::Fixed === $split ? $rest : null, PayerSplit::Fixed === $split && $cost->confirmedMinor->compare($fixed) < 0);
            $line->pieces = self::pieces($line, $fixed);

            foreach ($line->pieces as $piece) {
                $share = $shares[$piece->payer->getId()->toRfc4122()];
                $share->confirmedMinor = $share->confirmedMinor->add($piece->confirmedMinor);
                $share->potentialMinor = $share->potentialMinor->add($piece->potentialMinor);
                $share->covers[] = $piece;
            }

            $lines[] = $line;
        }

        $noPayerPaid = new Number(0);

        foreach ($payments as $payment) {
            $paid = $payment->getPaidAmountMinor();

            if (null === $paid || $payment->isCancelled()) {
                continue;
            }

            $covered = Vec\filter($lines, static fn (SplitLine $line): bool => $line->cost->line->getAgreedIn() === $payment->getEngagement());
            $weights = Vec\map($payers, static fn (Payer $payer): Number => self::sum(Vec\map(
                Vec\filter(Vec\flat_map($covered, static fn (SplitLine $line): array => $line->pieces), static fn (SplitPiece $piece): bool => $piece->payer === $payer),
                static fn (SplitPiece $piece): Number => $piece->confirmedMinor,
            )));
            $unclaimed = self::sum(Vec\map(Vec\filter($covered, static fn (SplitLine $line): bool => null === $line->split), static fn (SplitLine $line): Number => $line->cost->confirmedMinor));
            $amount = new Number($paid);

            if (self::sum([...$weights, $unclaimed])->compare(0) <= 0) {
                $noPayerPaid = $noPayerPaid->add($amount);

                continue;
            }

            $credits = Apportioner::apportion($amount, [...$weights, $unclaimed]);

            foreach ($payers as $index => $payer) {
                $share = $shares[$payer->getId()->toRfc4122()];
                $share->paidMinor = $share->paidMinor->add($credits[$index]);
            }

            $noPayerPaid = $noPayerPaid->add($credits[Iter\count($payers)]);
        }

        foreach ($shares as $share) {
            $share->covers = Vec\sort($share->covers, static fn (SplitPiece $a, SplitPiece $b): int => ($a->line->isNotPriced() <=> $b->line->isNotPriced()) ?: $b->confirmedMinor->compare($a->confirmedMinor));
        }

        return new self($lines, Vec\values($shares), $noPayerPaid);
    }

    /** @return list<SplitLine> */
    public function withPayer(): array
    {
        return Vec\filter($this->lines, static fn (SplitLine $line): bool => null !== $line->split);
    }

    /** @return list<SplitLine> */
    public function withNoPayer(): array
    {
        return Vec\filter($this->lines, static fn (SplitLine $line): bool => null === $line->split);
    }

    /** The card's next cost with no payer: the first in the budget's order that costs something, else the first. */
    public function next(): ?SplitLine
    {
        $none = $this->withNoPayer();

        return Iter\first(Vec\filter($none, static fn (SplitLine $line): bool => $line->cost->potentialMinor->compare(0) > 0)) ?? Iter\first($none);
    }

    /** @param list<Number> $amounts */
    public static function sum(array $amounts): Number
    {
        return Iter\reduce($amounts, static fn (Number $all, Number $one): Number => $all->add($one), new Number(0));
    }

    /** @return list<SplitPiece> */
    private static function pieces(SplitLine $line, Number $fixed): array
    {
        $low = $line->cost->confirmedMinor;
        $high = $line->cost->potentialMinor;

        return match ($line->split) {
            null => [],
            PayerSplit::One => Vec\map($line->parts, static fn (PayerPart $part): SplitPiece => new SplitPiece($line, $part->getPayer(), $low, $high, null, false)),
            PayerSplit::Percent => self::percentPieces($line, $low, $high),
            PayerSplit::Fixed => [
                ...Vec\map($line->parts, static fn (PayerPart $part): SplitPiece => new SplitPiece($line, $part->getPayer(), new Number($part->getValue()), new Number($part->getValue()), $part->getValue(), false)),
                $line->flagged
                    ? new SplitPiece($line, self::rest($line), new Number(0), new Number(0), null, true)
                    : new SplitPiece($line, self::rest($line), $low->sub($fixed), $high->sub($fixed), null, true),
            ],
        };
    }

    /** @return list<SplitPiece> */
    private static function percentPieces(SplitLine $line, Number $low, Number $high): array
    {
        $weights = Vec\map($line->parts, static fn (PayerPart $part): Number => new Number($part->getValue()));
        $lows = Apportioner::apportion($low, $weights);
        $highs = Apportioner::apportion($high, $weights);

        return Vec\map_with_key($line->parts, static fn (int $index, PayerPart $part): SplitPiece => new SplitPiece($line, $part->getPayer(), $lows[$index], $highs[$index], $part->getValue(), false));
    }

    private static function rest(SplitLine $line): Payer
    {
        return $line->rest ?? throw new LogicException('A fixed split names who covers the rest.');
    }

    /** sc-85's order: the nine categories as the budget lists them. */
    public static function categoryOrder(BudgetLine $line): int
    {
        return Iter\first_key(Dict\filter(CostCategory::cases(), static fn (CostCategory $category): bool => $category === $line->getCategory())) ?? 0;
    }
}
