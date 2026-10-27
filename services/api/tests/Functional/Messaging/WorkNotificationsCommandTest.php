<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\Command\WorkNotificationsCommand;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Trigger;
use App\Enum\Permission;
use DateTimeImmutable;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Psl\SecureRandom;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Tester\CommandTester;

final class WorkNotificationsCommandTest extends MessagingTestCase
{
    #[Test]
    public function onceSendsEverythingDueThenExitsLeavingWhatIsNotYetDue(): void
    {
        $members = Audience::membersWithPermission($this->organisation->getId(), Permission::BillingManage);
        self::scheduler()->schedule('test.notice', 'due', 'due', Trigger::at(new DateTimeImmutable('-1 minute')), $members);
        self::scheduler()->schedule('test.urgent', 'due-urgent', 'due-urgent', Trigger::at(new DateTimeImmutable('-1 minute')), $members);
        self::scheduler()->schedule('test.notice', 'tomorrow', 'tomorrow', Trigger::at(new DateTimeImmutable('+1 day')), $members);

        $tester = new CommandTester(new Application(self::$kernel ?? throw new LogicException('No kernel.'))->find(WorkNotificationsCommand::NAME));
        $exit = $tester->execute(['--once' => true]);

        self::assertSame(0, $exit);
        self::assertSame(['test.urgent', 'test.notice'], [self::sender()->sent[0]['notification']->subject, self::sender()->sent[1]['notification']->subject]);
        self::assertSame(1, self::rowCount("SELECT COUNT(*) FROM scheduled_notifications WHERE status = 'pending' AND cancellation_key = 'tomorrow'"));
    }

    #[Test]
    public function eachPollLeavesAHeartbeat(): void
    {
        $kernel = self::$kernel ?? throw new LogicException('No kernel.');
        $heartbeat = $kernel->getProjectDir() . '/var/notifications-worker-' . SecureRandom\string(12) . '.heartbeat';

        new CommandTester(new Application($kernel)->find(WorkNotificationsCommand::NAME))->execute(['--once' => true, '--heartbeat' => $heartbeat]);

        self::assertFileExists($heartbeat);
        \unlink($heartbeat);
    }
}
