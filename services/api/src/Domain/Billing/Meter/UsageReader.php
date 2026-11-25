<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter;

use App\Domain\Billing\Meter\Model\KindUsage;
use App\Domain\Billing\Meter\Model\UsageReading;
use App\Enum\UsageKind;
use App\Repository\SubscriptionRepository;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Psl\Dict;
use Psl\Math;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** The one read of usage (sc-3929), from the running totals and the billing account, never a sum of the records; nothing else counts usage. */
final readonly class UsageReader
{
    public function __construct(
        private Connection $connection,
        private SubscriptionRepository $subscriptionRepository,
        private SubscriptionPeriods $subscriptionPeriods,
        private ClockInterface $clock,
    ) {
    }

    /** For the period containing `$at`, ended or not; an ended period with the included amounts in force when it ended (sc-3929, 24 Nov). */
    public function read(Uuid $organisationId, ?DateTimeImmutable $at = null): UsageReading
    {
        $subscription = $this->subscriptionRepository->findCurrentOf($organisationId);
        $inForce = $this->subscriptionPeriods->containing($subscription, $at ?? $this->clock->now());
        $period = $inForce->period;

        $rows = Dict\reindex(Type\vec(self::row())->coerce($this->connection->fetchAllAssociative(
            'SELECT kind, used, included_used, included_held, credits_taken FROM usage_totals WHERE organisation_id = :organisation AND period_start = :start',
            ['organisation' => $organisationId->toRfc4122(), 'start' => $period->start->format('Y-m-d H:i:s')],
        )), static fn (array $row): string => $row['kind']);

        // A gauge: the latest measurement stands until the next, whichever period took it.
        $stored = Type\int()->coerce($this->connection->fetchOne(
            "SELECT used FROM usage_totals WHERE organisation_id = :organisation AND kind = 'storage_bytes' ORDER BY period_start DESC LIMIT 1",
            ['organisation' => $organisationId->toRfc4122()],
        ) ?: 0);

        $account = Type\shape(['credit_balance' => Type\int(), 'credits_held' => Type\int()])->coerce($this->connection->fetchAssociative(
            'SELECT credit_balance, credits_held FROM billing_accounts WHERE id = :id',
            ['id' => $subscription->getBillingAccount()->getId()->toRfc4122()],
        ));

        $kinds = [];

        foreach (UsageKind::cases() as $kind) {
            $row = $rows[$kind->value] ?? ['used' => 0, 'included_used' => 0, 'included_held' => 0, 'credits_taken' => 0];
            $included = $inForce->terms->limit($kind->limit())->allowance;
            $used = UsageKind::StorageBytes === $kind ? $stored : $row['used'];
            $taken = UsageKind::StorageBytes === $kind ? $stored : $row['included_used'] + $row['included_held'];

            $kinds[$kind->value] = new KindUsage(
                $used,
                $included,
                null === $included->amount ? null : Math\maxva(0, $included->amount - $taken),
                $row['credits_taken'],
            );
        }

        return new UsageReading($period, $kinds, $account['credit_balance'], $account['credits_held']);
    }

    /** @return Type\TypeInterface<array{kind: string, used: int, included_used: int, included_held: int, credits_taken: int}> */
    private static function row(): Type\TypeInterface
    {
        return Type\shape([
            'kind' => Type\string(),
            'used' => Type\int(),
            'included_used' => Type\int(),
            'included_held' => Type\int(),
            'credits_taken' => Type\int(),
        ]);
    }
}
