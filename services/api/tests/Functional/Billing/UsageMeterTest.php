<?php

declare(strict_types=1);

namespace App\Tests\Functional\Billing;

use App\Domain\Billing\Catalogue\Catalogue;
use App\Domain\Billing\Catalogue\CatalogueKeeper;
use App\Domain\Billing\Entitlements;
use App\Domain\Billing\Meter\Exception\BeforeTheFirstPeriod;
use App\Domain\Billing\Meter\Exception\ReservationRefused;
use App\Domain\Billing\Meter\Exception\UnknownReservation;
use App\Domain\Billing\Meter\Model\MeteredUse;
use App\Domain\Billing\Meter\Model\UsageReading;
use App\Domain\Billing\Meter\SubscriptionPeriods;
use App\Domain\Billing\Meter\UnitPricer;
use App\Domain\Billing\Meter\UsageMeter;
use App\Domain\Billing\Meter\UsagePublisher;
use App\Domain\Billing\Meter\UsageReader;
use App\Domain\Billing\Model\ChangedBy;
use App\Domain\Billing\SubscriptionChanger;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\UsageRecord;
use App\Enum\CataloguePart;
use App\Enum\Plan;
use App\Enum\RealtimeTopic;
use App\Enum\SubscriptionSource;
use App\Enum\UsageKind;
use App\Enum\UsagePayer;
use App\Enum\WhatsAppCategory;
use App\Repository\CatalogueVersionRepository;
use App\Repository\SubscriptionRepository;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Double\RecordingLogger;
use App\Tests\FunctionalTestCase;
use DateTimeImmutable;
use Doctrine\DBAL\Exception\DriverException;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Bridge\Doctrine\Middleware\Debug\DebugDataHolder;
use Symfony\Component\Clock\MockClock;
use Symfony\Component\Uid\Uuid;

/** sc-3929: one meter records each billable use once, from included first and then credits, and nobody pays for a message that never left. */
final class UsageMeterTest extends FunctionalTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string PERIOD_START = '2026-11-01 09:00:00';

    private MockClock $clock;
    private RecordingLogger $logger;
    private UsageMeter $meter;
    private Uuid $organisation;

    protected function setUp(): void
    {
        parent::setUp();

        $this->clock = new MockClock('2026-11-24 10:00:00', 'UTC');
        $this->logger = new RecordingLogger();
        $this->meter = $this->meterAt($this->clock);
        $this->organisation = $this->found('folake@ire.events', 'Ire Events');
    }

    #[Test]
    public function theMeterStartsEmptyAndReadsNothingUsedOfEveryKind(): void
    {
        $reading = $this->read();

        foreach (UsageKind::cases() as $kind) {
            self::assertSame(0, $reading->of($kind)->used, $kind->value);
            self::assertSame(0, $reading->of($kind)->fromCredits, $kind->value);
        }

        self::assertSame(2500, $reading->of(UsageKind::Email)->left);
        self::assertSame(0, $reading->creditBalance);
        self::assertSame(0, self::recordCount());
    }

    #[Test]
    public function theSameKeyRecordedTwiceLeavesOneRecordAndReturnsTheFirst(): void
    {
        $first = $this->meter->record($this->organisation, 'message-1', new MeteredUse(UsageKind::Email));
        $again = $this->meter->record($this->organisation, 'message-1', new MeteredUse(UsageKind::Email));

        self::assertTrue($first->getId()->equals($again->getId()));
        self::assertSame(1, self::recordCount());
        self::assertSame(1, $this->read()->of(UsageKind::Email)->used);
    }

    #[Test]
    public function theDatabaseHoldsAKeyToOneRecordAcrossTheMessageKinds(): void
    {
        $this->meter->record($this->organisation, 'message-1', new MeteredUse(UsageKind::Email));
        $connection = self::em()->getConnection();
        $row = Type\dict(Type\string(), Type\mixed())->coerce($connection->fetchAssociative('SELECT * FROM usage_records LIMIT 1'));

        $this->expectException(DriverException::class);
        $connection->executeStatement(
            "INSERT INTO usage_records (id, organisation_id, billing_account_id, kind, key_scope, idempotency_key, quantity, occurred_at, period_start, paid_by, included_quantity, credits_taken, credits_per_unit, late) VALUES (:id, :organisation, :account, 'sms', 'message', 'message-1', 1, now(), now(), 'credits', 0, 62, 62, false)",
            ['id' => Uuid::v7()->toRfc4122(), 'organisation' => $row['organisation_id'], 'account' => $row['billing_account_id']],
        );
    }

    #[Test]
    public function theDatabaseRefusesAMessageKeyedApartFromTheOtherMessageKinds(): void
    {
        $this->meter->record($this->organisation, 'message-1', new MeteredUse(UsageKind::Email));
        $connection = self::em()->getConnection();
        $row = Type\dict(Type\string(), Type\mixed())->coerce($connection->fetchAssociative('SELECT * FROM usage_records LIMIT 1'));

        $this->expectException(DriverException::class);
        $connection->executeStatement(
            "INSERT INTO usage_records (id, organisation_id, billing_account_id, kind, key_scope, idempotency_key, quantity, occurred_at, period_start, paid_by, included_quantity, credits_taken, credits_per_unit, late) VALUES (:id, :organisation, :account, 'sms', 'sms', 'message-1', 1, now(), now(), 'credits', 0, 62, 62, false)",
            ['id' => Uuid::v7()->toRfc4122(), 'organisation' => $row['organisation_id'], 'account' => $row['billing_account_id']],
        );
    }

    #[Test]
    public function aUsageRecordIsNeverEdited(): void
    {
        $this->meter->record($this->organisation, 'message-1', new MeteredUse(UsageKind::Email));

        $this->expectException(DriverException::class);
        self::em()->getConnection()->executeStatement('UPDATE usage_records SET credits_taken = 0');
    }

    #[Test]
    public function aStorageMeasurementIsMeasuredAgainButNeverTakesCredits(): void
    {
        $this->meter->measureStorage($this->organisation, new DateTimeImmutable('2026-11-24'), 500);

        $this->expectException(DriverException::class);
        self::em()->getConnection()->executeStatement("UPDATE usage_records SET credits_taken = 5 WHERE kind = 'storage_bytes'");
    }

    #[Test]
    public function fiftyOneEmailsCostFiftyOneUnits(): void
    {
        foreach (Vec\range(1, 51) as $n) {
            $this->meter->record($this->organisation, 'email-' . $n, new MeteredUse(UsageKind::Email));
        }

        $email = $this->read()->of(UsageKind::Email);

        self::assertSame([51, 2449, 0], [$email->used, $email->left, $email->fromCredits]);
        self::assertSame(51, self::recordCount());
    }

    #[Test]
    public function aRecordKeepsWhatPricedItAndWhatPaidForIt(): void
    {
        $this->credit(100);
        $hold = $this->meter->reserve($this->organisation, self::sms());
        $record = $this->meter->settle($hold->reservationId, 'message-1', self::sms());

        self::assertSame(
            [UsageKind::Sms, 1, 'NG', 'message-1', UsagePayer::Credits, 0, 62, 62, $this->catalogue()->unitCosts()->versionId->toRfc4122(), false],
            [$record->getKind(), $record->getQuantity(), $record->getCountry(), $record->getIdempotencyKey(), $record->getPaidBy(), $record->getIncludedQuantity(), $record->getCreditsTaken(), $record->getCreditsPerUnit(), $record->getUnitCostVersion()?->getId()->toRfc4122(), $record->isLate()],
        );
        self::assertSame([38, 0], [$this->read()->creditBalance, $this->read()->creditsHeld]);
    }

    #[Test]
    public function includedIsTakenBeforeCredits(): void
    {
        $this->credit(100);
        $hold = $this->meter->reserve($this->organisation, new MeteredUse(UsageKind::AiRequest, 7));

        self::assertSame([5, 2, 26], [$hold->includedUnits, $hold->creditUnits, $hold->credits()]);

        $records = Vec\map(Vec\range(1, 7), fn (int $n): UsageRecord => $this->meter->settle($hold->reservationId, 'interaction-' . $n, new MeteredUse(UsageKind::AiRequest)));

        self::assertSame(
            [UsagePayer::Included, UsagePayer::Included, UsagePayer::Included, UsagePayer::Included, UsagePayer::Included, UsagePayer::Credits, UsagePayer::Credits],
            Vec\map($records, static fn (UsageRecord $record): UsagePayer => $record->getPaidBy()),
        );
        $ai = $this->read()->of(UsageKind::AiRequest);
        self::assertSame([7, 0, 26], [$ai->used, $ai->left, $ai->fromCredits]);
        self::assertSame(74, $this->read()->creditBalance);
    }

    #[Test]
    public function aReservationTheCreditsCannotCoverIsRefusedAndHoldsNothing(): void
    {
        $this->credit(61);

        try {
            $this->meter->reserve($this->organisation, self::sms());
            self::fail('A reservation beyond the credits was taken.');
        } catch (ReservationRefused $refused) {
            self::assertSame([62, 61], [$refused->creditsNeeded, $refused->creditsFree]);
        }

        self::assertSame([61, 0], [$this->read()->creditBalance, $this->read()->creditsHeld]);
    }

    #[Test]
    public function emailIsNeverRefused(): void
    {
        $hold = $this->meter->reserve($this->organisation, new MeteredUse(UsageKind::Email, 3000));

        self::assertSame([2500, 500, 0], [$hold->includedUnits, $hold->creditUnits, $hold->credits()]);
    }

    #[Test]
    public function aSettleRetriedTakesOneUnitAndReturnsTheFirstRecord(): void
    {
        $this->credit(200);
        $hold = $this->meter->reserve($this->organisation, self::sms(2));

        $first = $this->meter->settle($hold->reservationId, 'message-1', self::sms());
        $again = $this->meter->settle($hold->reservationId, 'message-1', self::sms());

        self::assertTrue($first->getId()->equals($again->getId()));
        self::assertSame(1, self::recordCount());
        self::assertSame([200 - 62, 62], [$this->read()->creditBalance, $this->read()->creditsHeld]);
    }

    #[Test]
    public function aReleaseGivesBackWhatWasNotSettled(): void
    {
        $this->credit(200);
        $hold = $this->meter->reserve($this->organisation, self::sms(3));
        $this->meter->settle($hold->reservationId, 'message-1', self::sms());

        $this->meter->release($hold->reservationId);
        $this->meter->release($hold->reservationId);

        self::assertSame([200 - 62, 0], [$this->read()->creditBalance, $this->read()->creditsHeld]);
        self::assertSame(1, $this->read()->of(UsageKind::Sms)->used);
    }

    #[Test]
    public function aReservationUnsettledFor24HoursIsReleasedAndTheReleaseIsLogged(): void
    {
        $this->credit(200);
        $kept = $this->meter->reserve($this->organisation, self::sms());
        $this->clock->modify('+1 hour');
        $this->meter->reserve($this->organisation, self::sms());

        $this->clock->modify('+23 hours');
        self::assertSame(1, $this->meter->releaseExpired());
        self::assertSame(62, $this->read()->creditsHeld, 'the later reservation is not a day old');
        self::assertContains('A usage reservation went unsettled for 24 hours and is released.', Vec\map($this->logger->records, static fn (array $record): string => $record['message']));

        $this->clock->modify('+1 hour');
        self::assertSame(1, $this->meter->releaseExpired());
        self::assertSame(0, $this->meter->releaseExpired());
        self::assertSame([200, 0], [$this->read()->creditBalance, $this->read()->creditsHeld]);
        self::assertNotNull(self::em()->getConnection()->fetchOne('SELECT released_at FROM usage_reservations WHERE id = ?', [$kept->reservationId->toRfc4122()]));
    }

    #[Test]
    public function aSettleAfterTheReleaseIsRecordedAtItsPriceEvenBelowZeroAndLoggedAsLate(): void
    {
        $this->credit(62);
        $hold = $this->meter->reserve($this->organisation, self::sms());
        $this->clock->modify('+25 hours');
        $this->meter->releaseExpired();
        $this->credit(-30);

        $record = $this->meter->settle($hold->reservationId, 'message-1', self::sms());

        self::assertTrue($record->isLate());
        self::assertSame([62, UsagePayer::Credits], [$record->getCreditsTaken(), $record->getPaidBy()]);
        self::assertSame(-30, $this->read()->creditBalance);
        self::assertContains('A late settle: its reservation was released before it.', Vec\map($this->logger->records, static fn (array $record): string => $record['message']));
    }

    #[Test]
    public function aCatalogueChangeBetweenReserveAndSettleRepricesNothingReserved(): void
    {
        $this->credit(200);
        $hold = $this->meter->reserve($this->organisation, self::sms());
        $this->publishUnitCosts('2026-11-24', ['sms_per_segment', 'NG'], 40);
        self::assertSame(40, $this->catalogue()->unitCosts()->smsPerSegment('NG'));

        $record = $this->meter->settle($hold->reservationId, 'message-1', self::sms());

        self::assertSame([62, 62], [$record->getCreditsTaken(), $record->getCreditsPerUnit()]);
        self::assertTrue($hold->unitCostVersionId->equals($record->getUnitCostVersion()?->getId() ?? Uuid::v7()));
    }

    #[Test]
    public function aMessageReservedAsSmsSettlesAsWhatsAppAtTheReservationsPriceAndTheRestGoesBack(): void
    {
        $this->credit(100);
        $hold = $this->meter->reserve($this->organisation, self::sms());
        self::assertSame(62, $hold->credits());
        $this->publishUnitCosts('2026-11-24', ['whatsapp', 'utility', 'NG'], 1);

        $record = $this->meter->settle($hold->reservationId, 'message-1', self::whatsApp());

        self::assertSame([UsageKind::WhatsApp, WhatsAppCategory::Utility, 2, 2], [$record->getKind(), $record->getWhatsAppCategory(), $record->getCreditsTaken(), $record->getCreditsPerUnit()]);
        self::assertSame([98, 0], [$this->read()->creditBalance, $this->read()->creditsHeld], 'the other 60 go back at once');
        self::assertSame([0, 1, 2], [$this->read()->of(UsageKind::Sms)->used, $this->read()->of(UsageKind::WhatsApp)->used, $this->read()->of(UsageKind::WhatsApp)->fromCredits]);
    }

    #[Test]
    public function anIncludedSmsUnitPaysForTheMessageWhateverKindDeliveredIt(): void
    {
        $this->includeSms(100);
        $hold = $this->meter->reserve($this->organisation, self::sms());
        self::assertSame([1, 0], [$hold->includedUnits, $hold->creditUnits]);

        $record = $this->meter->settle($hold->reservationId, 'message-1', self::whatsApp());

        self::assertSame([UsageKind::WhatsApp, UsagePayer::Included, 1, 0], [$record->getKind(), $record->getPaidBy(), $record->getIncludedQuantity(), $record->getCreditsTaken()]);
        $sms = $this->read()->of(UsageKind::Sms);
        $whatsApp = $this->read()->of(UsageKind::WhatsApp);
        self::assertSame([1, 99, 0, 0], [$sms->used, $sms->left, $whatsApp->used, $whatsApp->fromCredits]);
        self::assertSame([0, 0], [$this->read()->creditBalance, $this->read()->creditsHeld]);
    }

    #[Test]
    public function anIncludedSmsUnitPaysForOneMessageOfSeveralUnitsAndTheRecordSaysOne(): void
    {
        $this->includeSms(100);
        $hold = $this->meter->reserve($this->organisation, self::sms());

        $record = $this->meter->settle($hold->reservationId, 'message-1', self::whatsApp(3));

        self::assertSame([3, UsagePayer::Included, 1, 0], [$record->getQuantity(), $record->getPaidBy(), $record->getIncludedQuantity(), $record->getCreditsTaken()]);
        $sms = $this->read()->of(UsageKind::Sms);
        self::assertSame([$record->getIncludedQuantity(), $record->getIncludedQuantity(), 0], [$sms->used, 100 - ($sms->left ?? 0), $this->read()->of(UsageKind::WhatsApp)->used]);
    }

    #[Test]
    public function aMessageDeliveredByEmailSpendsNoIncludedUnit(): void
    {
        $this->includeSms(100);
        $hold = $this->meter->reserve($this->organisation, self::sms());

        $record = $this->meter->settle($hold->reservationId, 'message-1', new MeteredUse(UsageKind::Email));

        self::assertSame([UsageKind::Email, 0], [$record->getKind(), $record->getCreditsTaken()]);
        self::assertSame([0, 100], [$this->read()->of(UsageKind::Sms)->used, $this->read()->of(UsageKind::Sms)->left]);
    }

    #[Test]
    public function aLateSettleAsAnotherKindTakesAnIncludedUnitOfTheReservedKindWhileOneIsLeftAndCreditsAfter(): void
    {
        $this->includeSms(1);
        $this->credit(100);
        $first = $this->meter->reserve($this->organisation, self::sms());
        $second = $this->meter->reserve($this->organisation, self::sms());
        self::assertSame([1, 0, 0, 1], [$first->includedUnits, $first->creditUnits, $second->includedUnits, $second->creditUnits]);
        $this->clock->modify('+25 hours');
        $this->meter->releaseExpired();

        $included = $this->meter->settle($first->reservationId, 'message-1', self::whatsApp());
        $credited = $this->meter->settle($second->reservationId, 'message-2', self::whatsApp());

        self::assertSame([true, UsagePayer::Included, 0], [$included->isLate(), $included->getPaidBy(), $included->getCreditsTaken()]);
        self::assertSame([true, UsagePayer::Credits, 2], [$credited->isLate(), $credited->getPaidBy(), $credited->getCreditsTaken()]);
        self::assertSame([1, 0], [$this->read()->of(UsageKind::Sms)->used, $this->read()->of(UsageKind::Sms)->left]);
        self::assertSame([1, 2], [$this->read()->of(UsageKind::WhatsApp)->used, $this->read()->of(UsageKind::WhatsApp)->fromCredits]);
        self::assertSame(98, $this->read()->creditBalance);
    }

    #[Test]
    public function aKindTheReservationsVersionDoesNotPriceIsPricedByTheFirstLaterVersionThatDoes(): void
    {
        $this->credit(100);
        $hold = $this->meter->reserve($this->organisation, new MeteredUse(UsageKind::Sms, 1, 'ZA'));
        $later = $this->publishUnitCosts('2026-11-24', ['whatsapp', 'marketing', 'ZA'], 9);

        $record = $this->meter->settle($hold->reservationId, 'message-1', new MeteredUse(UsageKind::WhatsApp, 1, 'ZA', WhatsAppCategory::Marketing));

        self::assertSame([9, 9, $later->toRfc4122()], [$record->getCreditsTaken(), $record->getCreditsPerUnit(), $record->getUnitCostVersion()?->getId()->toRfc4122()]);
    }

    #[Test]
    public function aMessageSettlingAsADearerKindIsChargedNoMoreThanItsHold(): void
    {
        $this->credit(100);
        $hold = $this->meter->reserve($this->organisation, self::whatsApp());

        $record = $this->meter->settle($hold->reservationId, 'message-1', self::sms());

        self::assertSame([UsageKind::Sms, 2, 62], [$record->getKind(), $record->getCreditsTaken(), $record->getCreditsPerUnit()]);
        self::assertSame([98, 0], [$this->read()->creditBalance, $this->read()->creditsHeld]);
    }

    #[Test]
    public function aServiceMessageCostsTheUtilityCredits(): void
    {
        $this->credit(100);
        $hold = $this->meter->reserve($this->organisation, new MeteredUse(UsageKind::WhatsApp, 1, 'NG', WhatsAppCategory::Service));

        self::assertSame(2, $hold->credits());
    }

    #[Test]
    public function oneKeySettledAsWhatsAppAndThenAsSmsLeavesOneRecord(): void
    {
        $this->credit(200);
        $hold = $this->meter->reserve($this->organisation, self::sms(2));

        $first = $this->meter->settle($hold->reservationId, 'message-1', self::whatsApp());
        $second = $this->meter->settle($hold->reservationId, 'message-1', self::sms());

        self::assertTrue($first->getId()->equals($second->getId()));
        self::assertSame(1, self::recordCount());
        self::assertSame(UsageKind::WhatsApp, $second->getKind());
    }

    #[Test]
    public function oneKeySettledAgainstTwoReservationsIsChargedOnceAndTheOtherHoldGoesBackOnce(): void
    {
        $this->credit(200);
        $whatsApp = $this->meter->reserve($this->organisation, self::whatsApp(2));
        $sms = $this->meter->reserve($this->organisation, self::sms(2));
        self::assertSame(4 + 124, $this->read()->creditsHeld);

        $first = $this->meter->settle($whatsApp->reservationId, 'code-1', self::whatsApp());
        $second = $this->meter->settle($sms->reservationId, 'code-1', self::sms());

        self::assertTrue($first->getId()->equals($second->getId()));
        self::assertSame(2, $second->getCreditsTaken(), 'priced from the reservation the first settle drew on');
        self::assertSame(2 + 62, $this->read()->creditsHeld, 'the SMS hold for the code went back at once, not at the sweep');

        $this->meter->settle($sms->reservationId, 'code-1', self::sms());
        self::assertSame(2 + 62, $this->read()->creditsHeld, 'a retry releases nothing more');
        self::assertSame([198, 1], [$this->read()->creditBalance, self::recordCount()]);
    }

    #[Test]
    public function twoOrganisationsSettlingUnderTheSameKeyAreEachChargedForTheirOwnMessage(): void
    {
        $other = $this->found('bayo@eko.events', 'Eko Events');
        $this->credit(100);
        $this->credit(100, $other);
        $ours = $this->meter->reserve($this->organisation, self::sms());
        $theirs = $this->meter->reserve($other, self::sms());

        $first = $this->meter->settle($ours->reservationId, 'message-1', self::sms());
        $second = $this->meter->settle($theirs->reservationId, 'message-1', self::sms());

        self::assertFalse($first->getId()->equals($second->getId()));
        self::assertTrue($second->getOrganisation()->getId()->equals($other));
        self::assertSame([62, 62], [$first->getCreditsTaken(), $second->getCreditsTaken()]);
        self::assertSame(2, self::recordCount());
    }

    #[Test]
    public function aUseOfNoUnitsIsRefused(): void
    {
        foreach ([0, -1] as $quantity) {
            try {
                new MeteredUse(UsageKind::AiRequest, $quantity);
                self::fail('A metered use of ' . $quantity . ' units was taken.');
            } catch (InvalidArgumentException) {
                self::assertSame(0, self::recordCount());
            }
        }
    }

    #[Test]
    public function aSettleNamingAnUnknownReservationIsRefusedAndRecordsNothing(): void
    {
        try {
            $this->meter->settle(Uuid::v7(), 'message-1', self::sms());
            self::fail('A settle against no reservation was taken.');
        } catch (UnknownReservation) {
            self::assertSame(0, self::recordCount());
        }
    }

    #[Test]
    public function aUseOneSecondBeforeThePeriodsEndCountsInThatPeriodAndOneAtItsStartInTheNext(): void
    {
        $this->clock->modify('2026-12-01 08:59:59');
        $this->meter->record($this->organisation, 'email-1', new MeteredUse(UsageKind::Email));
        $this->clock->modify('2026-12-01 09:00:00');
        $this->meter->record($this->organisation, 'email-2', new MeteredUse(UsageKind::Email));
        $this->meter->record($this->organisation, 'email-3', new MeteredUse(UsageKind::Email));

        $november = $this->read(new DateTimeImmutable('2026-11-30 12:00:00'));
        $december = $this->read(new DateTimeImmutable('2026-12-01 09:00:00'));

        self::assertSame(['2026-11-01T09:00:00+00:00', '2026-12-01T09:00:00+00:00'], [$november->period->start->format(\DATE_ATOM), $november->period->end->format(\DATE_ATOM)]);
        self::assertSame([1, 2], [$november->of(UsageKind::Email)->used, $december->of(UsageKind::Email)->used]);
    }

    #[Test]
    public function aSettleCountsInItsReservationsPeriodAndItsRecordSaysWhenItHappened(): void
    {
        $this->credit(100);
        $this->clock->modify('2026-12-01 08:59:30');
        $hold = $this->meter->reserve($this->organisation, self::sms());
        $this->clock->modify('2026-12-01 09:00:05');

        $record = $this->meter->settle($hold->reservationId, 'message-1', self::sms());

        self::assertSame(['2026-12-01T09:00:05+00:00', '2026-11-01T09:00:00+00:00'], [$record->getOccurredAt()->format(\DATE_ATOM), $record->getPeriodStart()->format(\DATE_ATOM)]);
        $november = $this->read(new DateTimeImmutable('2026-11-30 12:00:00'));
        $december = $this->read(new DateTimeImmutable('2026-12-01 09:00:05'));
        self::assertSame([1, 0], [$november->of(UsageKind::Sms)->used, $december->of(UsageKind::Sms)->used]);
    }

    #[Test]
    public function anUpgradeThatMovesThePeriodStartStartsANewPeriodWithNothingUsed(): void
    {
        $this->meter->record($this->organisation, 'email-1', new MeteredUse(UsageKind::Email));
        $this->clock->modify('2026-11-24 12:00:00');
        $subscription = self::service(SubscriptionRepository::class)->findCurrentOf($this->organisation);
        self::service(SubscriptionChanger::class)->movePeriodStart($subscription, new DateTimeImmutable('2026-11-24 11:30:00'), ChangedBy::staff('Ada at Soirely', 'Upgraded from Free'));
        self::em()->clear();

        self::assertSame(0, $this->read()->of(UsageKind::Email)->used);
        self::assertSame('2026-11-24T11:30:00+00:00', $this->read()->period->start->format(\DATE_ATOM));
    }

    #[Test]
    public function aChangeThatKeepsThePeriodStartKeepsWhatThePeriodUsed(): void
    {
        $this->meter->record($this->organisation, 'email-1', new MeteredUse(UsageKind::Email));
        self::em()->getConnection()->executeStatement("UPDATE subscriptions SET plan = 'enterprise' WHERE organisation_id = ?", [$this->organisation->toRfc4122()]);
        self::service(Entitlements::class)->forget($this->organisation);
        self::em()->clear();

        self::assertSame([1, 99999], [$this->read()->of(UsageKind::Email)->used, $this->read()->of(UsageKind::Email)->left]);
    }

    #[Test]
    public function aSendHeldBeforeAnUpgradeMovesThePeriodStartAndSettledAfterShowsInThePeriodTheMoveEnded(): void
    {
        $this->credit(100);
        $this->clock->modify('2026-11-20 11:00:00');
        $this->meter->record($this->organisation, 'email-1', new MeteredUse(UsageKind::Email));
        $hold = $this->meter->reserve($this->organisation, self::sms());
        $this->clock->modify('2026-11-20 12:00:00');
        $this->upgradeMovingThePeriodStartTo('2026-11-20 12:00:00');
        $this->clock->modify('2026-11-20 12:30:00');

        $this->meter->settle($hold->reservationId, 'message-1', self::sms());

        $ended = $this->read(new DateTimeImmutable('2026-11-15 00:00:00'));
        $next = $this->read(new DateTimeImmutable('2026-11-21 00:00:00'));
        self::assertSame(['2026-11-01T09:00:00+00:00', '2026-11-20T12:00:00+00:00'], [$ended->period->start->format(\DATE_ATOM), $ended->period->end->format(\DATE_ATOM)]);
        self::assertSame([1, 1, 2499], [$ended->of(UsageKind::Sms)->used, $ended->of(UsageKind::Email)->used, $ended->of(UsageKind::Email)->left]);
        self::assertSame(['2026-11-20T12:00:00+00:00', '2026-12-20T12:00:00+00:00'], [$next->period->start->format(\DATE_ATOM), $next->period->end->format(\DATE_ATOM)]);
        self::assertSame([0, 0, 100000], [$next->of(UsageKind::Sms)->used, $next->of(UsageKind::Email)->used, $next->of(UsageKind::Email)->left]);
    }

    #[Test]
    public function aPeriodWhoseStartMovedForwardThenBackEndsAtTheEarlierMove(): void
    {
        $this->clock->modify('2026-11-10 10:00:00');
        $subscription = self::service(SubscriptionRepository::class)->findCurrentOf($this->organisation);
        $this->changer()->movePeriodStart($subscription, new DateTimeImmutable('2026-12-01 09:00:00'), ChangedBy::staff('Ada at Soirely', 'Moved to yearly'));
        self::em()->clear();
        $this->clock->modify('2026-11-15 12:00:00');
        $this->upgradeMovingThePeriodStartTo('2026-11-15 12:00:00');

        $ended = $this->read(new DateTimeImmutable('2026-11-12 00:00:00'))->period;
        $next = $this->read(new DateTimeImmutable('2026-11-20 00:00:00'))->period;

        self::assertSame(['2026-11-01T09:00:00+00:00', '2026-11-15T12:00:00+00:00'], [$ended->start->format(\DATE_ATOM), $ended->end->format(\DATE_ATOM)]);
        self::assertSame(['2026-11-15T12:00:00+00:00', '2026-12-15T12:00:00+00:00'], [$next->start->format(\DATE_ATOM), $next->end->format(\DATE_ATOM)]);
    }

    #[Test]
    public function aLateSettleIntoAPeriodEndedByAnUpgradeIsPaidFromTheIncludedAmountsItEndedWith(): void
    {
        $this->includeSms(1);
        self::em()->getConnection()->executeStatement('UPDATE subscription_changes SET occurred_at = ?', [self::PERIOD_START]);
        $this->credit(100);
        $this->clock->modify('2026-11-20 11:00:00');
        $hold = $this->meter->reserve($this->organisation, self::sms());
        $this->clock->modify('2026-11-20 12:00:00');
        $this->upgradeMovingThePeriodStartTo('2026-11-20 12:00:00');
        $this->clock->modify('2026-11-21 12:00:00');
        $this->meter->releaseExpired();

        $record = $this->meter->settle($hold->reservationId, 'message-1', self::sms());

        self::assertSame([true, UsagePayer::Included, 1, 0], [$record->isLate(), $record->getPaidBy(), $record->getIncludedQuantity(), $record->getCreditsTaken()]);
        $sms = $this->read(new DateTimeImmutable('2026-11-15 00:00:00'))->of(UsageKind::Sms);
        self::assertSame([1, 0, 0], [$sms->used, $sms->left, $sms->fromCredits]);
    }

    #[Test]
    public function anEndedPeriodReadAfterAPlanChangeThatKeepsItsStartHasTheIncludedAmountsItEndedWith(): void
    {
        $this->meter->record($this->organisation, 'email-1', new MeteredUse(UsageKind::Email));
        $this->clock->modify('2026-12-05 10:00:00');
        $this->changer()->changePlan(self::service(SubscriptionRepository::class)->findCurrentOf($this->organisation), Plan::Enterprise, SubscriptionSource::Manual, ChangedBy::staff('Ada at Soirely', 'Moved to Enterprise'));
        self::em()->clear();

        $november = $this->read(new DateTimeImmutable('2026-11-15 00:00:00'));
        $december = $this->read();

        self::assertSame([1, 2499], [$november->of(UsageKind::Email)->used, $november->of(UsageKind::Email)->left]);
        self::assertSame([0, 100000], [$december->of(UsageKind::Email)->used, $december->of(UsageKind::Email)->left]);
    }

    #[Test]
    public function aReadForAMomentBeforeTheFirstPeriodStartIsRefused(): void
    {
        $this->expectException(BeforeTheFirstPeriod::class);

        $this->read(new DateTimeImmutable('2026-11-01 08:59:59'));
    }

    #[Test]
    public function aRecordPaidPartlyFromIncludedAndPartlyFromCreditsSaysCreditsWithItsIncludedUnits(): void
    {
        $this->includeSms(1);
        $this->credit(200);
        $hold = $this->meter->reserve($this->organisation, self::sms(2));

        $record = $this->meter->settle($hold->reservationId, 'message-1', self::sms(2));

        self::assertSame([2, UsagePayer::Credits, 1, 62], [$record->getQuantity(), $record->getPaidBy(), $record->getIncludedQuantity(), $record->getCreditsTaken()]);
        $sms = $this->read()->of(UsageKind::Sms);
        self::assertSame([2, 0, 62], [$sms->used, $sms->left, $sms->fromCredits]);
    }

    #[Test]
    public function storageReadsAsTheDaysLatestMeasurementNeverASum(): void
    {
        $this->meter->measureStorage($this->organisation, new DateTimeImmutable('2026-11-23'), 700);
        $this->meter->measureStorage($this->organisation, new DateTimeImmutable('2026-11-24'), 500);
        $this->meter->measureStorage($this->organisation, new DateTimeImmutable('2026-11-24'), 900);

        $storage = $this->read()->of(UsageKind::StorageBytes);

        self::assertSame([900, 2_000_000_000 - 900, 0], [$storage->used, $storage->left, $storage->fromCredits]);
        self::assertSame(2, self::recordCount(), 'one measurement per organisation per day');
    }

    #[Test]
    public function theReadMakesNoQueryOfUsageRecordsWhateverTheirNumber(): void
    {
        foreach (Vec\range(1, 30) as $n) {
            $this->meter->record($this->organisation, 'email-' . $n, new MeteredUse(UsageKind::Email));
        }

        $holder = Type\instance_of(DebugDataHolder::class)->coerce(self::getContainer()->get('test.doctrine.debug_data_holder'));
        $holder->reset();
        $this->read();
        $queries = Vec\flat_map($holder->getData(), static fn (array $byConnection): array => Vec\map($byConnection, static fn (array $query): string => Type\string()->coerce($query['sql'])));

        self::assertNotSame([], $queries);
        self::assertFalse(Iter\any($queries, static fn (string $sql): bool => Str\contains($sql, 'usage_records') || Str\contains($sql, 'assistant_interactions')), Json\encode($queries));
        self::assertLessThanOrEqual(5, Iter\count($queries));
    }

    #[Test]
    public function theRunningTotalsMatchTheRecords(): void
    {
        $this->credit(1000);
        $sms = $this->meter->reserve($this->organisation, self::sms(3));
        $ai = $this->meter->reserve($this->organisation, new MeteredUse(UsageKind::AiRequest, 8));
        $this->meter->settle($sms->reservationId, 'message-1', self::sms());
        $this->meter->settle($sms->reservationId, 'message-2', self::whatsApp());
        foreach (Vec\range(1, 8) as $n) {
            $this->meter->settle($ai->reservationId, 'interaction-' . $n, new MeteredUse(UsageKind::AiRequest));
        }
        $this->meter->record($this->organisation, 'email-1', new MeteredUse(UsageKind::Email));
        $this->meter->release($sms->reservationId);

        $summed = Dict\reindex(Type\vec(Type\shape(['kind' => Type\string(), 'used' => Type\int(), 'included' => Type\int(), 'credits' => Type\int()]))->coerce(self::em()->getConnection()->fetchAllAssociative(
            "SELECT kind, SUM(quantity)::int AS used, SUM(included_quantity)::int AS included, SUM(credits_taken)::int AS credits FROM usage_records WHERE organisation_id = ? AND kind <> 'storage_bytes' GROUP BY kind",
            [$this->organisation->toRfc4122()],
        )), static fn (array $row): string => $row['kind']);
        $totals = Dict\reindex(Type\vec(Type\shape(['kind' => Type\string(), 'used' => Type\int(), 'included' => Type\int(), 'held' => Type\int(), 'credits' => Type\int()]))->coerce(self::em()->getConnection()->fetchAllAssociative(
            'SELECT kind, used, included_used AS included, included_held AS held, credits_taken AS credits FROM usage_totals WHERE organisation_id = ?',
            [$this->organisation->toRfc4122()],
        )), static fn (array $row): string => $row['kind']);

        foreach ($summed as $kind => $row) {
            self::assertSame([$row['used'], $row['included'], $row['credits'], 0], [$totals[$kind]['used'], $totals[$kind]['included'], $totals[$kind]['credits'], $totals[$kind]['held']], $kind);
        }

        self::assertSame(1000 - Iter\reduce($summed, static fn (int $sum, array $row): int => $sum + $row['credits'], 0), $this->read()->creditBalance);
        self::assertSame(0, $this->read()->creditsHeld);
    }

    #[Test]
    public function aHubThatRefusesLeavesTheRecordAndTheSettleInPlace(): void
    {
        $hub = self::service(RecordingHub::class);
        $hub->failuresLeft = 10;
        $publisher = self::service(UsagePublisher::class);
        $meter = $this->meterAt($this->clock);
        $this->credit(100);

        $hold = $meter->reserve($this->organisation, self::sms());
        $publisher->flush();
        $record = $meter->settle($hold->reservationId, 'message-1', self::sms());
        $publisher->flush();

        self::assertSame([], $hub->published);
        self::assertSame(1, self::recordCount());
        self::assertSame(62, $record->getCreditsTaken());
        self::assertSame(38, $this->read()->creditBalance);
    }

    #[Test]
    public function aChangeIsPublishedPrivatelyOnTheOrganisationsOwnTopicAtMostOnceASecondAndOnceAfterTheLast(): void
    {
        $hub = self::service(RecordingHub::class);
        $publisher = self::service(UsagePublisher::class);
        $meter = $this->meterAt($this->clock);
        $topic = RealtimeTopic::OrganisationUsage->for($this->organisation->toRfc4122());

        foreach (Vec\range(1, 20) as $n) {
            $meter->record($this->organisation, 'email-' . $n, new MeteredUse(UsageKind::Email));
            $publisher->publishDue();
        }

        self::assertCount(1, $hub->published, 'the first change goes at once, the rest wait their second');

        $publisher->flush();

        self::assertCount(2, $hub->published);
        $last = $hub->lastOn($topic) ?? self::fail('nothing published on the organisation\'s topic');
        self::assertTrue($last->isPrivate());
        self::assertSame([$topic], $last->getTopics());
        self::assertSame(20, Type\shape(['kinds' => Type\shape(['email' => Type\shape(['used' => Type\int()], true)], true)], true)->coerce(Json\decode($last->getData()))['kinds']['email']['used']);
    }

    private function meterAt(MockClock $clock): UsageMeter
    {
        return new UsageMeter(
            self::em(),
            self::service(SubscriptionRepository::class),
            self::service(SubscriptionPeriods::class),
            $this->catalogue(),
            self::service(UnitPricer::class),
            self::service(UsagePublisher::class),
            $clock,
            $this->logger,
        );
    }

    private function read(?DateTimeImmutable $at = null): UsageReading
    {
        return self::service(UsageReader::class)->read($this->organisation, $at ?? $this->clock->now());
    }

    private function changer(): SubscriptionChanger
    {
        return new SubscriptionChanger(self::em(), $this->clock, self::service(Entitlements::class));
    }

    private function upgradeMovingThePeriodStartTo(string $start): void
    {
        $subscription = self::service(SubscriptionRepository::class)->findCurrentOf($this->organisation);
        $by = ChangedBy::staff('Ada at Soirely', 'Upgraded from Free');
        $this->changer()->changePlan($subscription, Plan::Enterprise, SubscriptionSource::Manual, $by);
        $this->changer()->movePeriodStart($subscription, new DateTimeImmutable($start), $by);
        self::em()->clear();
    }

    private function catalogue(): Catalogue
    {
        return self::service(Catalogue::class);
    }

    /** @param int<1, max> $segments */
    private static function sms(int $segments = 1): MeteredUse
    {
        return new MeteredUse(UsageKind::Sms, $segments, 'NG');
    }

    /** @param int<1, max> $messages */
    private static function whatsApp(int $messages = 1): MeteredUse
    {
        return new MeteredUse(UsageKind::WhatsApp, $messages, 'NG', WhatsAppCategory::Utility);
    }

    private function credit(int $credits, ?Uuid $organisation = null): void
    {
        self::em()->getConnection()->executeStatement(
            'UPDATE billing_accounts SET credit_balance = credit_balance + ? WHERE id = (SELECT billing_account_id FROM subscriptions WHERE organisation_id = ?)',
            [$credits, ($organisation ?? $this->organisation)->toRfc4122()],
        );
    }

    private function startPeriodAt(string $start, ?Uuid $organisation = null): void
    {
        self::em()->getConnection()->executeStatement('UPDATE subscriptions SET period_start = ? WHERE organisation_id = ?', [$start, ($organisation ?? $this->organisation)->toRfc4122()]);
        self::em()->clear();
    }

    /**
     * Publishes a unit-cost version with one cell changed; a fall applies at once.
     *
     * @param non-empty-list<string> $path
     */
    private function publishUnitCosts(string $name, array $path, int $credits): Uuid
    {
        $terms = (self::service(CatalogueVersionRepository::class)->findOneByName(CataloguePart::UnitCosts, '2026-10-19') ?? self::fail('The first version is missing.'))->getTerms();
        $cell = &$terms;

        foreach ($path as $key) {
            if (!\is_array($cell)) {
                self::fail('The unit costs have no ' . Str\join($path, '.'));
            }

            $cell = &$cell[$key];
        }

        $cell = $credits;
        unset($cell);

        return self::service(CatalogueKeeper::class)->publish(CataloguePart::UnitCosts, $name, $terms, 'Twilio repriced', 'Ada at Soirely')->getId();
    }

    private function includeSms(int $segments): void
    {
        $first = self::service(CatalogueVersionRepository::class)->findOneByName(CataloguePart::Plans, '2026-10-19') ?? self::fail('The first plans version is missing.');
        $terms = Type\dict(Type\string(), Type\dict(Type\string(), Type\mixed()))->coerce($first->getTerms());
        $limits = Type\dict(Type\string(), Type\mixed())->coerce($terms['free']['limits']);
        $limits['sms'] = ['kind' => 'metered', 'amount' => $segments];
        $terms['free']['limits'] = $limits;
        $keeper = self::service(CatalogueKeeper::class);
        $keeper->moveSubscribers($keeper->publish(CataloguePart::Plans, '2026-11-24', $terms, 'SMS included, for a test', 'Ada at Soirely'), null, 'SMS included, for a test', 'Ada at Soirely');
        self::service(Entitlements::class)->forget($this->organisation);
        self::em()->clear();
    }

    private static function recordCount(): int
    {
        return Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT count(*) FROM usage_records'));
    }

    private function found(string $email, string $name): Uuid
    {
        $owner = self::service(UserRegistrar::class)->register($email, 'Folake Adeyemi', self::PASSWORD)->user;
        $organisation = self::service(OrganisationFounder::class)->found($owner, $name, 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->startPeriodAt(self::PERIOD_START, $organisation->getId());

        return $organisation->getId();
    }
}
