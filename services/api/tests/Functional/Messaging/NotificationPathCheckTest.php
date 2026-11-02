<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\PathSymptom;
use App\Domain\Messaging\Model\Trigger;
use App\Domain\Messaging\NotificationPathCheck;
use App\Enum\Permission;
use App\Tests\Double\RecordingLogger;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\Test;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

final class NotificationPathCheckTest extends MessagingTestCase
{
    private RecordingLogger $logger;

    protected function setUp(): void
    {
        parent::setUp();
        $this->logger = new RecordingLogger();
    }

    #[Test]
    public function nothingWaitingIsNothingToSay(): void
    {
        self::assertSame([], $this->check());
        self::assertSame([], $this->logger->records);
    }

    #[Test]
    public function aRowWaitingFiveMinutesWithNothingClaimedIsStopped(): void
    {
        $this->due('-6 minutes');

        self::assertSame([PathSymptom::Stopped], $this->check());
        self::assertSame('critical', $this->logger->records[0]['level']);
        self::assertStringContainsString('stopped: 1 waiting', $this->logger->records[0]['message']);
    }

    #[Test]
    public function aLargeSendBeingWorkedThroughIsNotStopped(): void
    {
        $this->due('-6 minutes');
        $this->due('-6 minutes', 'other');
        self::worker()->step();

        self::assertSame([], $this->check());
    }

    #[Test]
    public function theOldestWaitingRowAtThirtyMinutesIsBehind(): void
    {
        $this->due('-31 minutes');
        $this->due('-31 minutes', 'other');
        self::worker()->step();

        self::assertSame([PathSymptom::Behind], $this->check());
    }

    #[Test]
    public function aRowHeldOrBackingOffIsNotWaiting(): void
    {
        $this->due('-6 minutes');
        self::worker()->step();
        self::connection()->executeStatement("UPDATE notification_deliveries SET held = 'paused', next_attempt_at = NOW() - INTERVAL '10 minutes', claimed_at = NOW() - INTERVAL '10 minutes'");
        self::connection()->executeStatement("UPDATE scheduled_notifications SET claimed_at = NOW() - INTERVAL '10 minutes'");

        self::assertSame([], $this->check());
    }

    #[Test]
    public function aScheduledRowHeldForADeletedEventIsNotWaiting(): void
    {
        $this->due('-6 minutes');
        self::connection()->executeStatement("UPDATE scheduled_notifications SET held = 'deleted', claimed_until = NOW() - INTERVAL '1 minute', claimed_at = NOW() - INTERVAL '10 minutes'");

        self::assertSame([], $this->check());
    }

    #[Test]
    public function overFivePercentOfAnHoursSendsFailedIsFailing(): void
    {
        $this->finished(18, 'sent');
        $this->finished(2, 'failed');

        self::assertSame([PathSymptom::Failing], $this->check());
        self::assertStringContainsString('10.0% of the last hour\'s 20 sends', $this->logger->records[0]['message']);
    }

    #[Test]
    public function anHourWithFewerThanTwentySendsIsNotJudged(): void
    {
        $this->finished(10, 'sent');
        $this->finished(9, 'failed');

        self::assertSame([], $this->check());
    }

    /** @return list<PathSymptom> */
    private function check(): array
    {
        return new NotificationPathCheck(self::connection(), self::service(ClockInterface::class), $this->logger)->run();
    }

    private function due(string $ago, string $key = 'waiting'): void
    {
        self::scheduler()->schedule('test.notice', $key, $key, Trigger::at(new DateTimeImmutable($ago)), Audience::membersWithPermission($this->organisation->getId(), Permission::BillingManage));
    }

    private function finished(int $count, string $status): void
    {
        $scheduled = self::scheduler()->schedule('test.notice', 'log-' . $status, 'log-' . $status, Trigger::at(new DateTimeImmutable('+1 day')), Audience::membersWithPermission($this->organisation->getId(), Permission::BillingManage));

        for ($i = 0; $i < $count; ++$i) {
            self::connection()->executeStatement(
                <<<'SQL'
                    INSERT INTO notification_deliveries (id, scheduled_notification_id, type, source_id, recipient_kind, recipient_id, channel, priority, status, due_at, next_attempt_at, attempts, created_at, finished_at)
                    VALUES (:id, :scheduled, 'test.notice', :source, 'member', :recipient, 'email', 1, :status, NOW(), NOW(), 1, NOW(), NOW() - INTERVAL '10 minutes')
                    SQL,
                ['id' => Uuid::v7()->toRfc4122(), 'scheduled' => $scheduled->toRfc4122(), 'source' => $status . $i, 'recipient' => $this->owner->getId()->toRfc4122(), 'status' => $status],
            );
        }
    }
}
