<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter;

use App\Domain\Billing\Catalogue\Catalogue;
use App\Domain\Billing\Catalogue\Model\PlanTerms;
use App\Domain\Billing\Entitlements;
use App\Domain\Billing\Meter\Exception\BeforeTheFirstPeriod;
use App\Domain\Billing\Meter\Model\PeriodTerms;
use App\Domain\Billing\Meter\Model\SubscriptionPeriod;
use App\Entity\Subscription;
use App\Enum\Plan;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Connection;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** The period a moment falls in, from the subscription's history of moved starts, and the plan terms in force when it ended (sc-3929, 24 Nov). */
final readonly class SubscriptionPeriods
{
    public function __construct(
        private Connection $connection,
        private Entitlements $entitlements,
        private Catalogue $catalogue,
    ) {
    }

    public function containing(Subscription $subscription, DateTimeImmutable $at): PeriodTerms
    {
        $changes = $this->changesOf($subscription);
        $moves = Vec\values(Vec\filter($changes, static fn (array $change): bool => 'period' === $change['kind']));
        $starts = [] === $moves
            ? [$subscription->getPeriodStart()]
            : [self::moment($moves[0]['from_value']), ...Vec\map($moves, static fn (array $move): DateTimeImmutable => self::moment($move['to_value']))];

        if ($at < $starts[0]) {
            throw new BeforeTheFirstPeriod('No period of the subscription contains ' . $at->format(\DATE_ATOM) . '.');
        }

        $anchor = 0;

        foreach ($starts as $index => $start) {
            if ($start <= $at) {
                $anchor = $index;
            }
        }

        $period = SubscriptionPeriod::containing($starts[$anchor], $at);
        $endedBy = null;

        foreach (Vec\slice($moves, $anchor) as $move) {
            if (null === $endedBy || self::moment($move['to_value']) < self::moment($endedBy['to_value'])) {
                $endedBy = $move;
            }
        }

        if (null === $endedBy) {
            return new PeriodTerms($period, $this->termsInForceBefore($subscription, $changes, $period->end));
        }

        $period = $period->endingAt(self::moment($endedBy['to_value']));

        // A move recorded before the start it names ends the period's terms at the move: the upgrade's plan is not the ended period's.
        return new PeriodTerms($period, $this->termsInForceBefore($subscription, $changes, $endedBy['occurred_at'] < $period->end ? $endedBy['occurred_at'] : $period->end));
    }

    /** @param list<array{kind: string, from_value: ?string, to_value: ?string, occurred_at: DateTimeImmutable, from_version: ?string}> $changes */
    private function termsInForceBefore(Subscription $subscription, array $changes, DateTimeImmutable $moment): PlanTerms
    {
        $later = Vec\reverse(Vec\filter($changes, static fn (array $change): bool => 'period' !== $change['kind'] && $change['occurred_at'] >= $moment));

        if ([] === $later) {
            return $this->entitlements->of($subscription->getOrganisation()->getId())->terms;
        }

        $plan = $subscription->getPlan();
        $version = $subscription->getCatalogueVersion()->getId();

        foreach ($later as $change) {
            if ('plan' === $change['kind']) {
                $plan = Plan::from(Type\string()->coerce($change['from_value']));
            } else {
                $version = Uuid::fromString(Type\string()->coerce($change['from_version']));
            }
        }

        return $this->catalogue->plansVersion($version)->plan($plan);
    }

    /** @return list<array{kind: string, from_value: ?string, to_value: ?string, occurred_at: DateTimeImmutable, from_version: ?string}> */
    private function changesOf(Subscription $subscription): array
    {
        $rows = Type\vec(Type\shape([
            'kind' => Type\string(),
            'from_value' => Type\nullable(Type\string()),
            'to_value' => Type\nullable(Type\string()),
            'occurred_at' => Type\string(),
            'from_version' => Type\nullable(Type\string()),
        ]))->coerce($this->connection->fetchAllAssociative(
            <<<'SQL'
                SELECT change.kind, change.from_value, change.to_value, change.occurred_at, version.id AS from_version
                FROM subscription_changes change
                LEFT JOIN catalogue_versions version
                    ON change.kind = 'catalogue_version' AND version.part = 'plans' AND version.name = change.from_value
                WHERE change.subscription_id = :subscription AND change.kind IN ('plan', 'period', 'catalogue_version')
                ORDER BY change.occurred_at, change.id
                SQL,
            ['subscription' => $subscription->getId()->toRfc4122()],
        ));

        return Vec\map($rows, static fn (array $row): array => [...$row, 'occurred_at' => new DateTimeImmutable($row['occurred_at'], new DateTimeZone('UTC'))]);
    }

    private static function moment(?string $atom): DateTimeImmutable
    {
        return new DateTimeImmutable(Type\string()->coerce($atom));
    }
}
