<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter;

use App\Domain\Billing\Catalogue\Catalogue;
use App\Domain\Billing\Catalogue\Model\Allowance;
use App\Domain\Billing\Entitlements;
use App\Domain\Billing\Meter\Exception\ReservationRefused;
use App\Domain\Billing\Meter\Exception\UnknownReservation;
use App\Domain\Billing\Meter\Model\Hold;
use App\Domain\Billing\Meter\Model\MeteredUse;
use App\Domain\Billing\Meter\Model\SubscriptionPeriod;
use App\Entity\BillingAccount;
use App\Entity\CatalogueVersion;
use App\Entity\Organisation;
use App\Entity\UsageHoldRelease;
use App\Entity\UsageRecord;
use App\Entity\UsageReservation;
use App\Enum\UsageKind;
use App\Enum\UsagePayer;
use App\Repository\SubscriptionRepository;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use InvalidArgumentException;
use LogicException;
use Psl\Iter;
use Psl\Math;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Uid\Uuid;

/** The one meter (sc-3929). Each write locks the billing account, so two sends from any of its organisations never both take its last units. */
final readonly class UsageMeter
{
    public const int RELEASE_AFTER_HOURS = 24;

    private const string DATETIME = 'Y-m-d H:i:s';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private SubscriptionRepository $subscriptionRepository,
        private Entitlements $entitlements,
        private Catalogue $catalogue,
        private UnitPricer $unitPricer,
        private UsagePublisher $usagePublisher,
        private ClockInterface $clock,
        private LoggerInterface $logger,
    ) {
    }

    public function reserve(Uuid $organisationId, MeteredUse $use): Hold
    {
        $subscription = $this->subscriptionRepository->findCurrentOf($organisationId);
        $version = $this->catalogue->unitCosts();
        $creditsPerUnit = $this->unitPricer->in($version, $use);
        $now = $this->now();
        $period = SubscriptionPeriod::containing($subscription->getPeriodStart(), $now);
        $allowance = $this->allowance($organisationId, $use->kind);
        $organisation = $subscription->getOrganisation();
        $account = $subscription->getBillingAccount();

        $reservation = $this->connection()->transactional(function () use ($organisation, $account, $version, $creditsPerUnit, $now, $period, $allowance, $use): UsageReservation {
            $balance = $this->lockAccount($account->getId());
            $includedUnits = Math\minva($use->quantity, $this->includedFree($organisation->getId(), $period->start, $use->kind, $allowance));
            $creditUnits = $use->quantity - $includedUnits;
            $credits = $creditUnits * $creditsPerUnit;
            $free = $balance['credit_balance'] - $balance['credits_held'];

            if (UsageKind::Email !== $use->kind && $credits > $free) {
                throw new ReservationRefused($use->kind, $credits, $free);
            }

            $reservation = new UsageReservation(
                $organisation,
                $account,
                $use->kind,
                $use->quantity,
                $use->country,
                $use->whatsAppCategory,
                $this->versionNamed($version->versionId),
                $creditsPerUnit,
                $period->start,
                $includedUnits,
                $creditUnits,
                $now,
            );
            $this->entityManager->persist($reservation);
            $this->entityManager->flush();

            $this->addToTotals($organisation->getId(), $period->start, $use->kind, includedHeld: $includedUnits);
            $this->addToAccount($account->getId(), held: $credits);

            return $reservation;
        });

        $this->usagePublisher->changed($organisationId);

        return new Hold($reservation->getId(), $use->kind, $use->quantity, $reservation->getIncludedUnits(), $reservation->getCreditUnits(), $version->versionId, $creditsPerUnit);
    }

    /** @param ?int<1, max> $heldUnits how many of the reservation's units the message was sent under, when it settled as another kind; the delivered quantity otherwise */
    public function settle(Uuid $reservationId, string $idempotencyKey, MeteredUse $delivered, ?int $heldUnits = null): UsageRecord
    {
        $owner = $this->ownerOf($reservationId);

        $record = $this->connection()->transactional(function () use ($owner, $reservationId, $idempotencyKey, $delivered, $heldUnits): UsageRecord {
            $reservation = $this->locked($owner, $reservationId);

            if ($delivered->kind !== $reservation->getKind() && !($delivered->kind->isMessage() && $reservation->getKind()->isMessage())) {
                throw new InvalidArgumentException('Only a message settles as another kind: ' . $reservation->getKind()->value . ' was reserved, ' . $delivered->kind->value . ' settled.');
            }

            $units = $delivered->kind === $reservation->getKind() ? $delivered->quantity : $heldUnits ?? $delivered->quantity;
            $existing = $this->recordUnder($delivered->kind, $idempotencyKey);

            if (null !== $existing) {
                return $this->settledBefore($existing, $reservation, $idempotencyKey, $units);
            }

            return $this->charge($reservation, $idempotencyKey, $delivered, $units);
        });

        $this->usagePublisher->changed($owner['organisation']);

        return $record;
    }

    public function release(Uuid $reservationId): void
    {
        $owner = $this->ownerOf($reservationId);

        $this->connection()->transactional(function () use ($owner, $reservationId): void {
            $reservation = $this->locked($owner, $reservationId);

            if (null !== $reservation->getReleasedAt()) {
                return;
            }

            [$included, $creditUnits] = $this->giveBack($reservation, \PHP_INT_MAX);
            $reservation->setReleasedAt($this->now());
            $this->entityManager->flush();

            $this->logger->info('A usage reservation was released.', ['reservationId' => $reservationId->toRfc4122(), 'includedUnits' => $included, 'creditUnits' => $creditUnits]);
        });

        $this->usagePublisher->changed($owner['organisation']);
    }

    public function releaseExpired(): int
    {
        $ids = Type\vec(Type\string())->coerce($this->connection()->fetchFirstColumn(
            'SELECT id FROM usage_reservations WHERE released_at IS NULL AND reserved_at <= :cutoff ORDER BY reserved_at',
            ['cutoff' => $this->now()->modify('-' . self::RELEASE_AFTER_HOURS . ' hours')->format(self::DATETIME)],
        ));

        foreach ($ids as $id) {
            $this->logger->info('A usage reservation went unsettled for 24 hours and is released.', ['reservationId' => $id]);
            $this->release(Uuid::fromString($id));
        }

        return Iter\count($ids);
    }

    /** An email, recorded as it is handed to the channel: email is never reserved against a balance and never blocks a send (sc-3929, 19 Oct). */
    public function record(Uuid $organisationId, string $idempotencyKey, MeteredUse $use): UsageRecord
    {
        if (UsageKind::Email !== $use->kind) {
            throw new InvalidArgumentException('Only email is recorded without a reservation: ' . $use->kind->value . ' reserves first.');
        }

        $subscription = $this->subscriptionRepository->findCurrentOf($organisationId);
        $version = $this->catalogue->unitCosts();
        $creditsPerUnit = $this->unitPricer->in($version, $use);
        $now = $this->now();
        $period = SubscriptionPeriod::containing($subscription->getPeriodStart(), $now);
        $allowance = $this->allowance($organisationId, $use->kind);
        $organisation = $subscription->getOrganisation();
        $account = $subscription->getBillingAccount();

        $record = $this->connection()->transactional(function () use ($organisation, $account, $idempotencyKey, $use, $version, $creditsPerUnit, $now, $period, $allowance): UsageRecord {
            $this->lockAccount($account->getId());
            $existing = $this->recordUnder($use->kind, $idempotencyKey);

            if (null !== $existing) {
                return $existing;
            }

            $included = Math\minva($use->quantity, $this->includedFree($organisation->getId(), $period->start, $use->kind, $allowance));
            $credits = ($use->quantity - $included) * $creditsPerUnit;

            $record = $this->written($organisation, $account, $use, $idempotencyKey, $now, $period->start, $included, $credits, $this->versionNamed($version->versionId), $creditsPerUnit, null, false);
            $this->addToTotals($organisation->getId(), $period->start, $use->kind, used: $use->quantity, includedUsed: $included, creditsTaken: $credits);
            $this->addToAccount($account->getId(), balance: -$credits);

            return $record;
        });

        $this->usagePublisher->changed($organisationId);

        return $record;
    }

    /** @param int<0, max> $bytes a gauge: one measurement per organisation per day, never reserved, settled or taken from credits */
    public function measureStorage(Uuid $organisationId, DateTimeImmutable $day, int $bytes): UsageRecord
    {
        $subscription = $this->subscriptionRepository->findCurrentOf($organisationId);
        $now = $this->now();
        $period = SubscriptionPeriod::containing($subscription->getPeriodStart(), $now);
        $key = $organisationId->toRfc4122() . '/' . $day->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d');
        $organisation = $subscription->getOrganisation();
        $account = $subscription->getBillingAccount();

        $record = $this->connection()->transactional(function () use ($organisation, $account, $bytes, $now, $period, $key): UsageRecord {
            $this->lockAccount($account->getId());
            $existing = $this->recordUnder(UsageKind::StorageBytes, $key);

            if (null !== $existing) {
                return $existing;
            }

            $record = new UsageRecord($organisation, $account, UsageKind::StorageBytes, $key, $bytes, null, null, $now, $period->start, UsagePayer::Included, $bytes, 0, null, 0, null, false);
            $this->entityManager->persist($record);
            $this->entityManager->flush();

            $this->connection()->executeStatement(
                <<<'SQL'
                    INSERT INTO usage_totals (organisation_id, period_start, kind, used, included_used, included_held, credits_taken)
                    VALUES (:organisation, :start, 'storage_bytes', :bytes, 0, 0, 0)
                    ON CONFLICT (organisation_id, period_start, kind) DO UPDATE SET used = EXCLUDED.used
                    SQL,
                ['organisation' => $organisation->getId()->toRfc4122(), 'start' => $period->start->format(self::DATETIME), 'bytes' => $bytes],
            );

            return $record;
        });

        $this->usagePublisher->changed($organisationId);

        return $record;
    }

    /** A key recorded from another reservation gives back this one's hold for the message, once (sc-3929, 27 Oct). */
    private function settledBefore(UsageRecord $existing, UsageReservation $reservation, string $idempotencyKey, int $units): UsageRecord
    {
        $settledAgainst = $existing->getReservation();

        if (null !== $settledAgainst && $settledAgainst->getId()->equals($reservation->getId())) {
            return $existing;
        }

        $scope = $existing->getKeyScope();
        $released = $this->entityManager->getRepository(UsageHoldRelease::class)->findOneBy(['reservation' => $reservation, 'keyScope' => $scope, 'idempotencyKey' => $idempotencyKey]);

        if (null !== $released) {
            return $existing;
        }

        [$included, $creditUnits] = $this->giveBack($reservation, $units);
        $this->entityManager->persist(new UsageHoldRelease($reservation, $scope, $idempotencyKey, $included + $creditUnits, $this->now()));
        $this->entityManager->flush();

        $this->logger->info('A settle under a key already recorded from another reservation released its own hold.', ['reservationId' => $reservation->getId()->toRfc4122(), 'recordId' => $existing->getId()->toRfc4122()]);

        return $existing;
    }

    private function charge(UsageReservation $reservation, string $idempotencyKey, MeteredUse $delivered, int $units): UsageRecord
    {
        $late = null !== $reservation->getReleasedAt();
        [$fromIncluded, $fromCredits] = $late ? [0, 0] : $this->takeFromHold($reservation, $units);
        $beyond = $units - $fromIncluded - $fromCredits;
        $organisationId = $reservation->getOrganisation()->getId();
        $periodStart = $reservation->getPeriodStart();
        $reservedPrice = $reservation->getCreditsPerUnit();
        $sameKind = $delivered->kind === $reservation->getKind();
        $free = $this->includedFree($organisationId, $periodStart, $delivered->kind, $this->allowance($organisationId, $delivered->kind));

        if ($sameKind) {
            $version = $reservation->getUnitCostVersion();
            $creditsPerUnit = $reservedPrice;
            $included = $fromIncluded + Math\minva($beyond, $free);
            $credits = ($delivered->quantity - $included) * $creditsPerUnit;
        } else {
            [$pricedBy, $creditsPerUnit] = $this->unitPricer->fromVersion($this->catalogue->unitCostsVersion($reservation->getUnitCostVersion()->getId()), $delivered);
            $version = $this->versionNamed($pricedBy->versionId);
            $included = Math\minva($delivered->quantity, $free);
            // Never above the hold: Soirely absorbs a dearer delivery, so the check at reserve still guarantees the credits (sc-3929, 26 Oct).
            $credits = Math\minva(($delivered->quantity - $included) * $creditsPerUnit, ($fromCredits + $beyond) * $reservedPrice);
        }

        $record = $this->written($reservation->getOrganisation(), $reservation->getBillingAccount(), $delivered, $idempotencyKey, $this->now(), $periodStart, $included, $credits, $version, $creditsPerUnit, $reservation, $late);

        if ($sameKind) {
            $this->addToTotals($organisationId, $periodStart, $delivered->kind, used: $delivered->quantity, includedUsed: $included, includedHeld: -$fromIncluded, creditsTaken: $credits);
        } else {
            $this->addToTotals($organisationId, $periodStart, $reservation->getKind(), includedHeld: -$fromIncluded);
            $this->addToTotals($organisationId, $periodStart, $delivered->kind, used: $delivered->quantity, includedUsed: $included, creditsTaken: $credits);
        }

        $this->addToAccount($reservation->getBillingAccount()->getId(), balance: -$credits, held: -($fromCredits * $reservedPrice));

        if ($late || $beyond > 0) {
            $this->logger->notice($late ? 'A late settle: its reservation was released before it.' : 'A settle went beyond what its reservation held.', ['reservationId' => $reservation->getId()->toRfc4122(), 'recordId' => $record->getId()->toRfc4122(), 'creditsTaken' => $credits]);
        }

        return $record;
    }

    private function written(
        Organisation $organisation,
        BillingAccount $account,
        MeteredUse $use,
        string $idempotencyKey,
        DateTimeImmutable $now,
        DateTimeImmutable $periodStart,
        int $included,
        int $credits,
        CatalogueVersion $version,
        int $creditsPerUnit,
        ?UsageReservation $reservation,
        bool $late,
    ): UsageRecord {
        $record = new UsageRecord(
            $organisation,
            $account,
            $use->kind,
            $idempotencyKey,
            $use->quantity,
            $use->country,
            $use->whatsAppCategory,
            $now,
            $periodStart,
            $included >= $use->quantity ? UsagePayer::Included : UsagePayer::Credits,
            $included,
            $credits,
            $version,
            $creditsPerUnit,
            $reservation,
            $late,
        );
        $this->entityManager->persist($record);
        $this->entityManager->flush();

        return $record;
    }

    /** @return array{int, int} the included units and the credit units taken, included first */
    private function takeFromHold(UsageReservation $reservation, int $units): array
    {
        $included = Math\minva($units, $reservation->getIncludedHeld());
        $creditUnits = Math\minva($units - $included, $reservation->getCreditUnitsHeld());
        $reservation->setIncludedHeld($reservation->getIncludedHeld() - $included);
        $reservation->setCreditUnitsHeld($reservation->getCreditUnitsHeld() - $creditUnits);
        $this->entityManager->flush();

        return [$included, $creditUnits];
    }

    /** @return array{int, int} the included units and the credit units given back */
    private function giveBack(UsageReservation $reservation, int $units): array
    {
        [$included, $creditUnits] = $this->takeFromHold($reservation, $units);
        $this->addToTotals($reservation->getOrganisation()->getId(), $reservation->getPeriodStart(), $reservation->getKind(), includedHeld: -$included);
        $this->addToAccount($reservation->getBillingAccount()->getId(), held: -($creditUnits * $reservation->getCreditsPerUnit()));

        return [$included, $creditUnits];
    }

    /** @return array{organisation: Uuid, account: Uuid} */
    private function ownerOf(Uuid $reservationId): array
    {
        $row = $this->connection()->fetchAssociative('SELECT organisation_id, billing_account_id FROM usage_reservations WHERE id = :id', ['id' => $reservationId->toRfc4122()]);

        if (false === $row) {
            throw new UnknownReservation('No reservation ' . $reservationId->toRfc4122() . ' to settle or release.');
        }

        $row = Type\shape(['organisation_id' => Type\string(), 'billing_account_id' => Type\string()])->coerce($row);

        return ['organisation' => Uuid::fromString($row['organisation_id']), 'account' => Uuid::fromString($row['billing_account_id'])];
    }

    /** @param array{organisation: Uuid, account: Uuid} $owner */
    private function locked(array $owner, Uuid $reservationId): UsageReservation
    {
        $this->lockAccount($owner['account']);
        $reservation = $this->entityManager->find(UsageReservation::class, $reservationId) ?? throw new UnknownReservation('No reservation ' . $reservationId->toRfc4122() . ' to settle or release.');
        $this->entityManager->refresh($reservation);

        return $reservation;
    }

    private function recordUnder(UsageKind $kind, string $idempotencyKey): ?UsageRecord
    {
        return $this->entityManager->getRepository(UsageRecord::class)->findOneBy(['keyScope' => $kind->keyScope(), 'idempotencyKey' => $idempotencyKey]);
    }

    private function allowance(Uuid $organisationId, UsageKind $kind): Allowance
    {
        return $this->entitlements->of($organisationId)->terms->limit($kind->limit())->allowance;
    }

    /** @return int<0, max> what the period's included amount has left that no reservation holds */
    private function includedFree(Uuid $organisationId, DateTimeImmutable $periodStart, UsageKind $kind, Allowance $allowance): int
    {
        if (null === $allowance->amount) {
            return \PHP_INT_MAX;
        }

        $taken = Type\int()->coerce($this->connection()->fetchOne(
            'SELECT included_used + included_held FROM usage_totals WHERE organisation_id = :organisation AND period_start = :start AND kind = :kind',
            ['organisation' => $organisationId->toRfc4122(), 'start' => $periodStart->format(self::DATETIME), 'kind' => $kind->value],
        ) ?: 0);

        return Math\maxva(0, $allowance->amount - $taken);
    }

    /** @return array{credit_balance: int, credits_held: int} */
    private function lockAccount(Uuid $accountId): array
    {
        $row = $this->connection()->fetchAssociative('SELECT credit_balance, credits_held FROM billing_accounts WHERE id = :id FOR UPDATE', ['id' => $accountId->toRfc4122()]);

        if (false === $row) {
            throw new LogicException('A usage write names a billing account that does not exist.');
        }

        return Type\shape(['credit_balance' => Type\int(), 'credits_held' => Type\int()])->coerce($row);
    }

    private function addToTotals(Uuid $organisationId, DateTimeImmutable $periodStart, UsageKind $kind, int $used = 0, int $includedUsed = 0, int $includedHeld = 0, int $creditsTaken = 0): void
    {
        $this->connection()->executeStatement(
            <<<'SQL'
                INSERT INTO usage_totals (organisation_id, period_start, kind, used, included_used, included_held, credits_taken)
                VALUES (:organisation, :start, :kind, :used, :included_used, :included_held, :credits_taken)
                ON CONFLICT (organisation_id, period_start, kind) DO UPDATE SET
                    used          = usage_totals.used + EXCLUDED.used,
                    included_used = usage_totals.included_used + EXCLUDED.included_used,
                    included_held = usage_totals.included_held + EXCLUDED.included_held,
                    credits_taken = usage_totals.credits_taken + EXCLUDED.credits_taken
                SQL,
            [
                'organisation' => $organisationId->toRfc4122(),
                'start' => $periodStart->format(self::DATETIME),
                'kind' => $kind->value,
                'used' => $used,
                'included_used' => $includedUsed,
                'included_held' => $includedHeld,
                'credits_taken' => $creditsTaken,
            ],
        );
    }

    private function addToAccount(Uuid $accountId, int $balance = 0, int $held = 0): void
    {
        $this->connection()->executeStatement(
            'UPDATE billing_accounts SET credit_balance = credit_balance + :balance, credits_held = credits_held + :held WHERE id = :id',
            ['balance' => $balance, 'held' => $held, 'id' => $accountId->toRfc4122()],
        );
    }

    private function versionNamed(Uuid $versionId): CatalogueVersion
    {
        return $this->entityManager->getReference(CatalogueVersion::class, $versionId) ?? throw new LogicException('No catalogue version ' . $versionId->toRfc4122() . '.');
    }

    private function connection(): Connection
    {
        return $this->entityManager->getConnection();
    }

    private function now(): DateTimeImmutable
    {
        $now = $this->clock->now()->setTimezone(new DateTimeZone('UTC'));

        // The columns keep whole seconds, so a record reads back as it was written.
        return $now->setTime((int) $now->format('G'), (int) $now->format('i'), (int) $now->format('s'));
    }
}
