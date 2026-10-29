<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\Channel\EmailSender;
use App\Domain\Messaging\Command\WorkNotificationsCommand;
use App\Domain\Messaging\EventMuter;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Trigger;
use App\Entity\User;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Tests\Double\Messaging\Meanwhile;
use App\Tests\Double\Messaging\RecordingHub;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Mailer\Mailer;
use Symfony\Component\Mailer\Transport;

final class InAppNotificationsTest extends MessagingTestCase
{
    #[Test]
    public function anInAppDeliveryIsAnItemInTheMembersBellPublishedOnTheirTopic(): void
    {
        $event = $this->event();
        self::scheduler()->schedule('test.bell', 'bell:1', 'bell-1', Trigger::at(new DateTimeImmutable('-1 minute')), $this->everyone(), ['line' => 'The start time is now 19:00 (was 18:00).', 'place' => '/events/' . $event->getId()->toRfc4122()], $event);

        self::runUntilIdle();

        $item = Type\shape([
            'user_id' => Type\string(),
            'category' => Type\string(),
            'title' => Type\string(),
            'lines' => Type\string(),
            'event_id' => Type\string(),
            'event_name' => Type\string(),
            'place' => Type\string(),
        ], true)->coerce(self::connection()->fetchAssociative('SELECT * FROM notification_items'));
        self::assertSame([$this->owner->getId()->toRfc4122(), 'event_changes', 'test.bell', ['The start time is now 19:00 (was 18:00).'], $event->getId()->toRfc4122(), 'Gala', '/events/' . $event->getId()->toRfc4122()], [$item['user_id'], $item['category'], $item['title'], Json\decode($item['lines']), $item['event_id'], $item['event_name'], $item['place']]);

        $published = self::hub()->published;
        self::assertCount(1, $published);
        self::assertSame(['users/' . $this->owner->getId()->toRfc4122() . '/notifications'], $published[0]->getTopics());
        self::assertTrue($published[0]->isPrivate());
        self::assertSame(['test.bell', false, true, false], Vec\map(['title', 'read', 'eventAvailable', 'muted'], static fn (string $field): mixed => Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($published[0]->getData()))[$field]));
    }

    #[Test]
    public function aHubThatRefusesIsRetriedWithoutASecondItem(): void
    {
        self::hub()->failuresLeft = 1;
        self::scheduler()->schedule('test.bell', 'bell:1', 'bell-1', Trigger::at(new DateTimeImmutable('-1 minute')), $this->everyone());
        self::runUntilIdle();
        self::connection()->executeStatement("UPDATE notification_deliveries SET next_attempt_at = NOW() - INTERVAL '1 second' WHERE channel = 'in_app'");

        self::runUntilIdle();

        self::assertSame(1, self::rowCount('SELECT COUNT(*) FROM notification_items'));
        self::assertCount(1, self::hub()->published);
        self::assertSame('sent', self::scalar("SELECT status FROM notification_deliveries WHERE channel = 'in_app'"));
    }

    #[Test]
    public function aMutedEventReachesTheBellAloneMarkedMuted(): void
    {
        $event = $this->event();
        self::service(EventMuter::class)->set($this->owner, $event, true);
        self::scheduler()->schedule('test.bell', 'bell:1', 'bell-1', Trigger::at(new DateTimeImmutable('-1 minute')), $this->everyone(), [], $event);

        self::runUntilIdle();

        self::assertSame(['in_app'], Type\vec(Type\string())->coerce(self::connection()->fetchFirstColumn('SELECT channel FROM notification_deliveries')));
        self::assertSame([], self::sender()->sent);
        self::assertTrue(Type\dict(Type\string(), Type\mixed())->coerce(Json\decode(self::hub()->published[0]->getData()))['muted']);
    }

    #[Test]
    public function aMuteIsOnlyItsOwnersAndLeavesTheOtherMembersDeliveriesAsTheyWere(): void
    {
        $event = $this->event();
        $other = $this->member('other', SeededRole::Administrator);
        self::service(EventMuter::class)->set($this->owner, $event, true);
        self::scheduler()->schedule('test.bell', 'bell:1', 'bell-1', Trigger::at(new DateTimeImmutable('-1 minute')), $this->everyone(), [], $event);

        self::runUntilIdle();

        $channels = static fn (User $member): array => Type\vec(Type\string())->coerce(self::connection()->fetchFirstColumn(
            'SELECT channel FROM notification_deliveries WHERE recipient_id = :member ORDER BY channel',
            ['member' => $member->getId()->toRfc4122()],
        ));
        $marked = static fn (User $member): mixed => self::scalar('SELECT muted FROM notification_items WHERE user_id = :member', ['member' => $member->getId()->toRfc4122()]);
        self::assertSame(['in_app'], $channels($this->owner));
        self::assertSame(['email', 'in_app'], $channels($other));
        self::assertSame([true, false], [$marked($this->owner), $marked($other)]);
        self::assertSame(['OTHER'], self::sentTo());
    }

    /** sc-104's Urgent first, with the in-app item it has no sender for (sc-3980 tests bullet). */
    #[Test]
    public function anInAppItemIsTheNextClaimedWhileALargeSendIsGoingOut(): void
    {
        $scheduled = self::scheduler()->schedule('test.notice', 'bulk', 'bulk', Trigger::at(new DateTimeImmutable('+1 hour')), $this->everyone());
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

        self::scheduler()->schedule('test.bell', 'bell', 'bell', Trigger::at(new DateTimeImmutable('-1 second')), $this->everyone());
        self::worker()->step();
        self::worker()->step();

        self::assertSame(3, self::sender()->calls);
        self::assertSame(1, self::rowCount('SELECT COUNT(*) FROM notification_items'));
    }

    /** sc-104's A stalled provider holds nothing up, with an in-app item falling due while an email hangs. */
    #[Test]
    public function anInAppItemFallingDueWhileAnEmailHangsIsHandedToTheBellWithinFiveSeconds(): void
    {
        $server = \stream_socket_server('tcp://127.0.0.1:0') ?: self::fail('No listening socket.');
        $address = \stream_socket_get_name($server, false) ?: self::fail('No address.');
        $previous = \ini_get('default_socket_timeout');
        // @mago-expect lint:no-ini-set the worker's own setting, which is what bounds the hung call
        \ini_set('default_socket_timeout', (string) WorkNotificationsCommand::PROVIDER_CALL_LIMIT);
        self::sender()->through = new EmailSender(new Mailer(Transport::fromDsn('smtp://' . $address)), 'Soirely <hello@soirely.test>');

        try {
            self::scheduler()->schedule('test.interrupted', 'hung', 'hung', Trigger::at(new DateTimeImmutable('-1 minute')), $this->everyone());
            self::worker()->step();
            $due = 0.0;
            self::service(Meanwhile::class)->happens = function () use (&$due): void {
                $due = \microtime(true);
                self::scheduler()->schedule('test.bell', 'bell', 'bell', Trigger::at(new DateTimeImmutable('-1 second')), $this->everyone());
            };

            self::worker()->step();
            self::assertSame(1, self::sender()->calls, 'the email was not the call that hung');

            while (0 === self::rowCount('SELECT COUNT(*) FROM notification_items') && \microtime(true) - $due < 10.0) {
                self::worker()->step();
            }

            self::assertSame(1, self::rowCount('SELECT COUNT(*) FROM notification_items'));
            self::assertLessThan(5.0, \microtime(true) - $due);
        } finally {
            // @mago-expect lint:no-ini-set put back for the rest of the suite
            \ini_set('default_socket_timeout', (string) $previous);
            \fclose($server);
        }
    }

    private static function hub(): RecordingHub
    {
        return self::service(RecordingHub::class);
    }

    private function everyone(): Audience
    {
        return Audience::membersWithPermission($this->organisation->getId(), Permission::EventsRead);
    }
}
