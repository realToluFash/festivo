<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter\Model;

use App\Enum\UsageKind;
use LogicException;
use Psl\Dict;

/** What an organisation has used in one period, kind by kind, and its billing account's credits: the one answer every screen, warning and invoice reads (sc-3929). */
final readonly class UsageReading
{
    /** @param array<string, KindUsage> $kinds by `UsageKind` value, every one present */
    public function __construct(
        public SubscriptionPeriod $period,
        private array $kinds,
        public int $creditBalance,
        public int $creditsHeld,
    ) {
    }

    public function of(UsageKind $kind): KindUsage
    {
        return $this->kinds[$kind->value] ?? throw new LogicException('A reading lacks ' . $kind->value . '.');
    }

    /** @return array{periodStart: string, periodEnd: string, kinds: array<string, array{used: int, included: int|'unlimited', left: int|'unlimited', fromCredits: int}>, creditBalance: int, creditsHeld: int} */
    public function written(): array
    {
        return [
            'periodStart' => $this->period->start->format(\DATE_ATOM),
            'periodEnd' => $this->period->end->format(\DATE_ATOM),
            'kinds' => Dict\map($this->kinds, static fn (KindUsage $usage): array => $usage->written()),
            'creditBalance' => $this->creditBalance,
            'creditsHeld' => $this->creditsHeld,
        ];
    }
}
