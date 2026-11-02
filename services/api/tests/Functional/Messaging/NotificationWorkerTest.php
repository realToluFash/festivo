<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\Exception\UnregisteredNotificationType;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Trigger;
use App\Entity\Membership;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Tests\Double\Messaging\Meanwhile;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\Test;
use Psl\Type;
use Psl\Type\Exception\CoercionException;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

final class NotificationWorkerTest extends MessagingTestCase
{
    #[Test]
    public function aTypeOutsideTheRegistryCannotBeScheduled(): void
    {
        $this->expectException(UnregisteredNotificationType::class);

        self::scheduler()->schedule('payment.reminder', 'k', 's', Trigger::at(new DateTimeImmutable()), $this->budgetHolders());
    }

    #[Test]
    public function aMemberAudienceIsTheMembersHoldingThePermissionWhenItIsSent(): void
    {
        $this->member('manager', SeededRole::EventManager);
        $leaving = $this->member('leaving', SeededRole::Administrator);
        self::scheduler()->schedule('test.notice', 'budget:1', 'payment-1', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders(), ['line' => 'Pay the florist']);
        $this->member('joined', SeededRole::Administrator);
        $membership = self::em()->getRepository(Membership::class)->findOneBy(['user' => $leaving]) ?? self::fail('no membership');
        $membership->setStatus(MembershipStatus::LeftOrRemoved, new DateTimeImmutable());
        self::em()->flush();

        self::runUntilIdle();

        self::assertSame(['JOINED', 'OWNER'], Vec\sort(self::sentTo()));
    }

    #[Test]
    public function aRowNotYetDueIsLeftPending(): void
    {
        self::scheduler()->schedule('test.notice', 'later', 'later', Trigger::at(new DateTimeImmutable('+1 hour')), $this->budgetHolders());

        self::runUntilIdle();

        self::assertSame([], self::sender()->sent);
        self::assertSame(1, self::rowCount("SELECT COUNT(*) FROM scheduled_notifications WHERE status = 'pending'"));
    }

    #[Test]
    public function schedulingAgainWithAPendingKeyReplacesTheRow(): void
    {
        self::scheduler()->schedule('test.notice', 'reminder:1', 'r1', Trigger::at(new DateTimeImmutable('+1 day')), $this->budgetHolders());
        self::scheduler()->schedule('test.notice', 'reminder:1', 'r1', Trigger::at(new DateTimeImmutable('+2 days')), $this->budgetHolders());

        self::assertSame(1, self::rowCount("SELECT COUNT(*) FROM scheduled_notifications WHERE cancellation_key = 'reminder:1' AND status = 'pending'"));
        self::assertEqualsWithDelta(
            new DateTimeImmutable('+2 days')->getTimestamp(),
            new DateTimeImmutable(Type\string()->coerce(self::scalar("SELECT due_at FROM scheduled_notifications WHERE status = 'pending'")))->getTimestamp(),
            5,
        );
    }

    #[Test]
    public function cancellingAKeyRemovesItsPendingRowsAndSendsNothing(): void
    {
        self::scheduler()->schedule('test.notice', 'payment:7', 'p7', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders());
        self::worker()->step();
        self::assertSame(1, self::rowCount("SELECT COUNT(*) FROM notification_deliveries WHERE status = 'pending'"));

        self::assertSame(1, self::scheduler()->cancel('payment:7'));
        self::assertSame(0, self::scheduler()->cancel('payment:7'));
        self::runUntilIdle();

        self::assertSame([], self::sender()->sent);
        self::assertSame(0, self::rowCount('SELECT COUNT(*) FROM notification_deliveries'));
        self::assertSame(0, self::rowCount("SELECT COUNT(*) FROM scheduled_notifications WHERE status = 'pending'"));
    }

    #[Test]
    public function aRowWhoseCheckFailsAtSendTimeIsRecordedCancelled(): void
    {
        self::scheduler()->schedule('test.notice', 'paid', 'paid', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders(), ['stillDue' => false]);

        self::runUntilIdle();

        self::assertSame([], self::sender()->sent);
        self::assertSame('cancelled', self::scalar('SELECT status FROM scheduled_notifications'));
    }

    #[Test]
    public function oneIdempotencyKeyIsOneDeliveryAndOneProviderCall(): void
    {
        self::scheduler()->schedule('test.notice', 'first', 'payment-9', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders());
        self::scheduler()->schedule('test.notice', 'doubled', 'payment-9', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders());

        self::runUntilIdle();

        self::assertSame(1, self::sender()->calls);
        self::assertSame(1, self::rowCount('SELECT COUNT(*) FROM notification_deliveries'));
        self::assertSame(
            'provider-' . Type\string()->coerce(self::scalar('SELECT id FROM notification_deliveries')),
            self::scalar('SELECT provider_message_id FROM notification_deliveries'),
        );
    }

    #[Test]
    public function aRowClaimedByAWorkerThatStoppedIsSentOnceItsClaimExpires(): void
    {
        self::scheduler()->schedule('test.notice', 'claimed', 'claimed', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders());
        self::worker()->step();
        self::connection()->executeStatement("UPDATE notification_deliveries SET claimed_at = NOW(), claimed_until = NOW() + INTERVAL '1 minute'");

        self::runUntilIdle();
        self::assertSame(0, self::sender()->calls);

        self::connection()->executeStatement("UPDATE notification_deliveries SET claimed_until = NOW() - INTERVAL '2 seconds'");
        self::runUntilIdle();
        self::runUntilIdle();

        self::assertSame(1, self::sender()->calls);
        self::assertSame('sent', self::scalar('SELECT status FROM notification_deliveries'));
    }

    #[Test]
    public function aFailedSendIsRetriedWithBackoffThenRecordedFailedWithTheReason(): void
    {
        self::sender()->failuresLeft = 5;
        self::scheduler()->schedule('test.notice', 'flaky', 'flaky', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders());

        self::runUntilIdle();
        $retry = new DateTimeImmutable(Type\string()->coerce(self::scalar('SELECT next_attempt_at FROM notification_deliveries')));
        self::assertSame('pending', self::scalar('SELECT status FROM notification_deliveries'));
        self::assertGreaterThan(new DateTimeImmutable('+2 minutes'), $retry);

        for ($attempt = 2; $attempt <= 5; ++$attempt) {
            self::connection()->executeStatement("UPDATE notification_deliveries SET next_attempt_at = NOW() - INTERVAL '2 seconds'");
            self::runUntilIdle();
        }

        self::assertSame(5, self::sender()->calls);
        self::assertSame('failed', self::scalar('SELECT status FROM notification_deliveries'));
        self::assertStringContainsString('550 the provider said no', Type\string()->coerce(self::scalar('SELECT last_error FROM notification_deliveries')));
    }

    #[Test]
    public function aSendPastItsTypesLimitIsRecordedTooLateAndNeverSent(): void
    {
        self::scheduler()->schedule('test.timely', 'stale', 'stale', Trigger::at(new DateTimeImmutable('-2 hours')), $this->budgetHolders());

        self::runUntilIdle();

        self::assertSame([], self::sender()->sent);
        self::assertSame('too_late', self::scalar('SELECT status FROM scheduled_notifications'));
    }

    #[Test]
    public function aDeliveryThatWaitedPastItsLimitIsRecordedTooLate(): void
    {
        self::scheduler()->schedule('test.timely', 'waited', 'waited', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders());
        self::worker()->step();
        self::connection()->executeStatement("UPDATE notification_deliveries SET send_by = NOW() - INTERVAL '2 seconds'");

        self::runUntilIdle();

        self::assertSame([], self::sender()->sent);
        self::assertSame('too_late', self::scalar('SELECT status FROM notification_deliveries'));
    }

    #[Test]
    public function severalDueThingsForOnePersonGoOutAsOneMessage(): void
    {
        foreach (['florist', 'caterer', 'band'] as $vendor) {
            self::scheduler()->schedule('test.collapsing', "pay:{$vendor}", "pay:{$vendor}", Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders(), ['line' => "Pay the {$vendor}"]);
        }

        self::runUntilIdle();

        self::assertSame(1, self::sender()->calls);
        self::assertSame("Pay the florist\nPay the caterer\nPay the band", self::sender()->sent[0]['notification']->body);
        self::assertSame(3, self::rowCount("SELECT COUNT(*) FROM notification_deliveries WHERE status = 'sent'"));
    }

    #[Test]
    public function anUrgentRowIsTheNextClaimedWhileALargeSendIsGoingOut(): void
    {
        $scheduled = self::scheduler()->schedule('test.notice', 'bulk', 'bulk', Trigger::at(new DateTimeImmutable('+1 hour')), $this->budgetHolders());
        self::connection()->executeStatement(
            <<<'SQL'
                INSERT INTO notification_deliveries (id, scheduled_notification_id, type, source_id, recipient_kind, recipient_id, channel, priority, status, due_at, next_attempt_at, attempts, created_at)
                SELECT gen_random_uuid(), :scheduled, 'test.notice', 'bulk-' || n, 'member', :owner, 'email', 1, 'pending', NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 minute', 0, NOW()
                FROM generate_series(1, 1500) n
                SQL,
            ['scheduled' => $scheduled->toRfc4122(), 'owner' => $this->owner->getId()->toRfc4122()],
        );
        self::worker()->step();
        self::worker()->step();
        self::worker()->step();

        self::scheduler()->schedule('test.urgent', 'code', 'code', Trigger::at(new DateTimeImmutable('-1 second')), $this->budgetHolders(), ['line' => 'Your code']);
        self::worker()->step();
        self::worker()->step();

        self::assertSame(4, self::sender()->calls);
        self::assertSame('test.urgent', self::sender()->sent[3]['notification']->subject);
    }

    #[Test]
    public function anOlderInfoRowGoesBeforeANewerNormalOne(): void
    {
        self::scheduler()->schedule('test.info', 'info', 'info', Trigger::at(new DateTimeImmutable('-10 minutes')), $this->budgetHolders());
        self::scheduler()->schedule('test.notice', 'normal', 'normal', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders());

        self::runUntilIdle();

        self::assertSame(['test.info', 'test.notice'], Vec\map(self::sender()->sent, static fn (array $sent): string => $sent['notification']->subject));
    }

    #[Test]
    public function aRowCancelledAfterItsClaimWritesNoDeliveries(): void
    {
        self::scheduler()->schedule('test.interrupted', 'payment:8', 'p8', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders());
        self::service(Meanwhile::class)->happens = static fn (): int => self::scheduler()->cancel('payment:8');

        self::runUntilIdle();

        self::assertSame([], self::sender()->sent);
        self::assertSame(0, self::rowCount('SELECT COUNT(*) FROM notification_deliveries'));
        self::assertSame('cancelled', self::scalar('SELECT status FROM scheduled_notifications'));
    }

    #[Test]
    public function aRowReplacedAfterItsClaimWritesNoDeliveries(): void
    {
        self::scheduler()->schedule('test.interrupted', 'reminder:2', 'r2', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders());
        $audience = $this->budgetHolders();
        self::service(Meanwhile::class)->happens = static fn (): Uuid => self::scheduler()->schedule('test.interrupted', 'reminder:2', 'r2', Trigger::at(new DateTimeImmutable('+1 day')), $audience);

        self::runUntilIdle();

        self::assertSame([], self::sender()->sent);
        self::assertSame(0, self::rowCount('SELECT COUNT(*) FROM notification_deliveries'));
        self::assertSame(1, self::rowCount("SELECT COUNT(*) FROM scheduled_notifications WHERE status = 'pending'"));
    }

    #[Test]
    public function aDeliveryCancelledWhileAWorkerSendsItIsRecordedAndNotSentAgain(): void
    {
        self::scheduler()->schedule('test.interrupted', 'reminder:3', 'r3', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders());
        self::worker()->step();
        self::service(Meanwhile::class)->happens = static fn (): int => self::scheduler()->cancel('reminder:3');

        self::runUntilIdle();
        self::scheduler()->schedule('test.interrupted', 'reminder:3', 'r3', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders());
        self::runUntilIdle();

        self::assertSame(1, self::sender()->calls);
        self::assertSame(1, self::rowCount('SELECT COUNT(*) FROM notification_deliveries'));
        self::assertSame('sent', self::scalar('SELECT status FROM notification_deliveries'));
    }

    #[Test]
    public function aDeliveryCancelledWhileItsSendFailsIsDeletedAndNotTriedAgain(): void
    {
        self::sender()->failuresLeft = 1;
        self::scheduler()->schedule('test.interrupted', 'reminder:4', 'r4', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders());
        self::worker()->step();
        self::service(Meanwhile::class)->happens = static fn (): int => self::scheduler()->cancel('reminder:4');

        self::runUntilIdle();
        self::connection()->executeStatement("UPDATE notification_deliveries SET next_attempt_at = NOW() - INTERVAL '2 seconds'");
        self::runUntilIdle();

        self::assertSame(1, self::sender()->calls);
        self::assertSame(0, self::rowCount('SELECT COUNT(*) FROM notification_deliveries'));
    }

    #[Test]
    public function aDeliveryCancelledWhileItsWorkerHasStoppedIsDeletedOnceItsClaimExpires(): void
    {
        self::scheduler()->schedule('test.notice', 'stopped', 'stopped', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders());
        self::worker()->step();
        self::connection()->executeStatement("UPDATE notification_deliveries SET claimed_at = NOW(), claimed_until = NOW() + INTERVAL '1 minute'");
        self::scheduler()->cancel('stopped');

        self::connection()->executeStatement("UPDATE notification_deliveries SET claimed_until = NOW() - INTERVAL '2 seconds'");
        self::runUntilIdle();

        self::assertSame(0, self::sender()->calls);
        self::assertSame(0, self::rowCount('SELECT COUNT(*) FROM notification_deliveries'));
    }

    #[Test]
    public function aRowWhoseCheckThrowsIsRecordedFailedAndTheNextOneStillGoes(): void
    {
        self::scheduler()->schedule('test.notice', 'broken', 'broken', Trigger::at(new DateTimeImmutable('-2 minutes')), $this->budgetHolders(), ['stillDue' => 'not a yes or no']);
        self::scheduler()->schedule('test.notice', 'fine', 'fine', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders());

        self::runUntilIdle();

        self::assertSame(1, self::sender()->calls);
        self::assertSame('failed', self::scalar("SELECT status FROM scheduled_notifications WHERE cancellation_key = 'broken'"));
        self::assertSame(CoercionException::class, self::scalar("SELECT outcome FROM scheduled_notifications WHERE cancellation_key = 'broken'"));
    }

    #[Test]
    public function aDeliveryWhoseCheckThrowsIsRecordedFailed(): void
    {
        self::scheduler()->schedule('test.notice', 'broken', 'broken', Trigger::at(new DateTimeImmutable('-1 minute')), $this->budgetHolders());
        self::worker()->step();
        self::connection()->executeStatement(<<<'SQL'
            UPDATE scheduled_notifications SET payload = '{"stillDue": "not a yes or no"}'
            SQL);

        self::runUntilIdle();

        self::assertSame([], self::sender()->sent);
        self::assertSame('failed', self::scalar('SELECT status FROM notification_deliveries'));
        self::assertSame(CoercionException::class, self::scalar('SELECT last_error FROM notification_deliveries'));
    }

    #[Test]
    public function aGuestAudienceIsAcceptedAndWaitsForItsResolver(): void
    {
        $event = $this->event();
        self::scheduler()->schedule('test.guest', 'guests', 'guests', Trigger::at(new DateTimeImmutable('-1 minute')), Audience::guests($event->getId(), ['replied' => false]), [], $event);

        self::runUntilIdle();

        self::assertSame('failed', self::scalar('SELECT status FROM scheduled_notifications'));
        self::assertSame('nothing resolves a guest audience yet', self::scalar('SELECT outcome FROM scheduled_notifications'));
    }

    private function budgetHolders(): Audience
    {
        return Audience::membersWithPermission($this->organisation->getId(), Permission::BudgetMargin);
    }
}
