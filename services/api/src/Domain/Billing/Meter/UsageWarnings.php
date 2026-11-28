<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter;

use App\Domain\Billing\Catalogue\Model\Allowance;
use App\Domain\Billing\Meter\Model\SubscriptionPeriod;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Trigger;
use App\Domain\Messaging\NotificationScheduler;
use App\Enum\Permission;
use App\Enum\UsageKind;
use Doctrine\DBAL\Connection;
use Psl\Iter;
use Psl\Math;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Uid\Uuid;

/** The 80% and 100% warnings on an included amount (sc-3931), and support's alert above twice the included storage. Asked by the meter inside its write, with the billing account locked, so two uses crossing at once warn once. */
final readonly class UsageWarnings
{
    /** @var non-empty-list<int> highest first, so a jump past both sends only the higher */
    public const array THRESHOLDS = [100, 80];

    public const int SUPPORT_THRESHOLD = 200;

    private const string DATETIME = 'Y-m-d H:i:s';

    public function __construct(
        private Connection $connection,
        private NotificationScheduler $notificationScheduler,
        private ClockInterface $clock,
        private LoggerInterface $logger,
    ) {
    }

    /** @param int $draftCost the credits one assistant draft costs, for the line under an assistant drafts warning */
    public function after(Uuid $organisationId, SubscriptionPeriod $period, UsageKind $kind, int $used, Allowance $included, int $draftCost): void
    {
        $amount = $included->amount;

        if (!self::warns($kind) || null === $amount || 0 === $amount) {
            return;
        }

        $thresholds = UsageKind::StorageBytes === $kind ? [self::SUPPORT_THRESHOLD, ...self::THRESHOLDS] : self::THRESHOLDS;
        $crossed = Vec\filter($thresholds, fn (int $threshold): bool => $this->crosses($organisationId, $period, $kind, $threshold, $used * 100 >= $threshold * $amount));

        if (Iter\contains($crossed, self::SUPPORT_THRESHOLD)) {
            $this->logger->critical('An organisation\'s storage is above twice its included amount: support is to get in touch (sc-3931, sc-3952).', ['organisationId' => $organisationId->toRfc4122(), 'bytes' => $used, 'included' => $amount]);
        }

        $warned = Vec\filter($crossed, static fn (int $threshold): bool => self::SUPPORT_THRESHOLD !== $threshold);

        if ([] === $warned) {
            return;
        }

        $threshold = Math\max($warned);
        $key = Str\format('usage-warning:%s:%s:%d:%s', $organisationId->toRfc4122(), $kind->value, $threshold, $period->start->format(\DATE_ATOM));

        $this->notificationScheduler->schedule(
            UsageWarningNotice::NAME,
            $key,
            $key,
            Trigger::at($this->clock->now()),
            Audience::membersWithPermission($organisationId, Permission::BillingRead),
            UsageWarningNotice::payload($organisationId, $kind, $threshold, $used, $amount, $period->end, $draftCost),
        );
    }

    /** Assistant drafts start from nothing each period; storage is a level, warned again only once it has fallen below and risen past again. */
    private function crosses(Uuid $organisationId, SubscriptionPeriod $period, UsageKind $kind, int $threshold, bool $above): bool
    {
        $row = $this->connection->fetchAssociative(
            'SELECT above, warned_period_start FROM usage_warnings WHERE organisation_id = :organisation AND kind = :kind AND threshold = :threshold',
            ['organisation' => $organisationId->toRfc4122(), 'kind' => $kind->value, 'threshold' => $threshold],
        );
        $row = false === $row ? null : Type\shape(['above' => Type\bool(), 'warned_period_start' => Type\nullable(Type\string())])->coerce($row);
        $warnedThisPeriod = ($row['warned_period_start'] ?? null) === $period->start->format(self::DATETIME);
        $wasAbove = UsageKind::StorageBytes === $kind && true === ($row['above'] ?? false);
        $crosses = $above && !$wasAbove && !$warnedThisPeriod;

        $this->connection->executeStatement(
            <<<'SQL'
                INSERT INTO usage_warnings (organisation_id, kind, threshold, above, warned_period_start)
                VALUES (:organisation, :kind, :threshold, :above, :warned)
                ON CONFLICT (organisation_id, kind, threshold) DO UPDATE SET
                    above               = EXCLUDED.above,
                    warned_period_start = COALESCE(EXCLUDED.warned_period_start, usage_warnings.warned_period_start)
                SQL,
            [
                'organisation' => $organisationId->toRfc4122(),
                'kind' => $kind->value,
                'threshold' => $threshold,
                'above' => $above ? 'true' : 'false',
                'warned' => $crosses ? $period->start->format(self::DATETIME) : null,
            ],
        );

        return $crosses;
    }

    private static function warns(UsageKind $kind): bool
    {
        return UsageKind::AiRequest === $kind || UsageKind::StorageBytes === $kind;
    }
}
