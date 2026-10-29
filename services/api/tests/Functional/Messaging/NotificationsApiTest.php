<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Trigger;
use App\Domain\Messaging\NotificationScheduler;
use App\Domain\Messaging\NotificationWorker;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\EventType;
use App\Enum\Permission;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Iter;
use Psl\Json;
use Psl\Type;
use Psl\Vec;

final class NotificationsApiTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = self::service(UserRegistrar::class)->register('folake@ire.events', 'Folake', self::PASSWORD)->user;
        self::onboard($this->owner, withOrganisation: false);
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
    }

    #[Test]
    public function theFeedIsTheMembersOwnItemsNewestFirstWithTheUnreadCount(): void
    {
        $event = $this->event();
        $this->notify('first', $event);
        $this->notify('second', $event);
        $stranger = self::service(UserRegistrar::class)->register('tomi@example.com', 'Tomi', self::PASSWORD)->user;
        self::onboard($stranger);

        $feed = $this->as($this->owner, 'GET', '/api/notifications');

        self::assertSame(200, $this->statusCode(), Json\encode($feed));
        self::assertSame(2, $feed['unreadCount']);
        self::assertNull($feed['next']);
        $items = self::items($feed);
        self::assertSame([['second'], ['first']], Vec\map($items, static fn (array $item): mixed => $item['lines']));
        self::assertSame(
            ['category' => 'event_changes', 'title' => 'test.bell', 'eventId' => $event->getId()->toRfc4122(), 'eventName' => 'Gala', 'eventAvailable' => true, 'muted' => false, 'place' => '/events/x', 'read' => false],
            Dict\filter_keys($items[0], static fn (string $key): bool => !Iter\contains(['id', 'createdAt', 'lines'], $key)),
        );

        $theirs = $this->as($stranger, 'GET', '/api/notifications');
        self::assertSame(['items' => [], 'unreadCount' => 0, 'next' => null], $theirs);
    }

    #[Test]
    public function openingAnItemMarksItReadAndSomebodyElsesIsNotFound(): void
    {
        $this->notify('only', null);
        $id = Type\string()->coerce(self::items($this->as($this->owner, 'GET', '/api/notifications'))[0]['id']);
        $stranger = self::service(UserRegistrar::class)->register('tomi@example.com', 'Tomi', self::PASSWORD)->user;
        self::onboard($stranger);

        $this->as($stranger, 'POST', '/api/notifications/' . $id . '/read');
        self::assertSame(404, $this->statusCode());

        $read = $this->as($this->owner, 'POST', '/api/notifications/' . $id . '/read');
        self::assertSame(200, $this->statusCode(), Json\encode($read));
        self::assertSame(0, $read['unreadCount']);
        self::assertTrue(Type\dict(Type\string(), Type\mixed())->coerce($read['item'])['read']);
        self::assertFalse(Type\dict(Type\string(), Type\mixed())->coerce($read['item'])['eventAvailable']);
    }

    #[Test]
    public function markAllReadLeavesNothingUnread(): void
    {
        $this->notify('one', null);
        $this->notify('two', null);

        self::assertSame(['unreadCount' => 0], $this->as($this->owner, 'POST', '/api/notifications/read-all'));
        self::assertSame([true, true], Vec\map(self::items($this->as($this->owner, 'GET', '/api/notifications')), static fn (array $item): mixed => $item['read']));
    }

    #[Test]
    public function aDeletedEventsItemKeepsItsNameAndIsNoLongerAvailable(): void
    {
        $event = $this->event();
        $this->notify('gone', $event);
        self::connection()->executeStatement('UPDATE events SET deleted_at = NOW() WHERE id = :id', ['id' => $event->getId()->toRfc4122()]);

        $item = self::items($this->as($this->owner, 'GET', '/api/notifications'))[0];

        self::assertSame([$event->getId()->toRfc4122(), 'Gala', false], [$item['eventId'], $item['eventName'], $item['eventAvailable']]);
    }

    #[Test]
    public function itemsOlderThanNinetyDaysAreNotInTheFeed(): void
    {
        $this->notify('old', null);
        self::connection()->executeStatement("UPDATE notification_items SET created_at = NOW() - INTERVAL '91 days'");

        self::assertSame(['items' => [], 'unreadCount' => 0, 'next' => null], $this->as($this->owner, 'GET', '/api/notifications'));
    }

    #[Test]
    public function theFeedPagesByTheLastItemsIdEvenWithinOneSecond(): void
    {
        foreach (Vec\range(1, 31) as $n) {
            $this->notify((string) $n, null);
        }
        self::connection()->executeStatement("UPDATE notification_items SET created_at = '2026-10-27 09:00:00'");

        $first = $this->as($this->owner, 'GET', '/api/notifications');
        $second = $this->as($this->owner, 'GET', '/api/notifications?after=' . Type\string()->coerce($first['next']));

        self::assertCount(30, self::items($first));
        self::assertCount(1, self::items($second));
        self::assertNull($second['next']);
        self::assertCount(31, Vec\unique([...Vec\map(self::items($first), static fn (array $item): mixed => $item['id']), ...Vec\map(self::items($second), static fn (array $item): mixed => $item['id'])]));
    }

    #[Test]
    public function signedOutGetsNoFeed(): void
    {
        $this->client->request('GET', '/api/notifications');

        self::assertSame(401, $this->statusCode());
    }

    #[Test]
    public function settingsAreTheSixCategoriesWithTheProductDefaults(): void
    {
        $settings = $this->as($this->owner, 'GET', '/api/auth/notification-settings');

        self::assertSame([
            ['category' => 'guest_replies', 'push' => ['on' => true, 'switchable' => true], 'email' => ['on' => true, 'switchable' => true]],
            ['category' => 'messages', 'push' => ['on' => true, 'switchable' => true], 'email' => ['on' => true, 'switchable' => true]],
            ['category' => 'event_day', 'push' => ['on' => true, 'switchable' => true], 'email' => ['on' => false, 'switchable' => true]],
            ['category' => 'event_changes', 'push' => ['on' => true, 'switchable' => true], 'email' => ['on' => true, 'switchable' => true]],
            ['category' => 'money', 'push' => ['on' => true, 'switchable' => true], 'email' => ['on' => true, 'switchable' => true]],
            ['category' => 'account_security', 'push' => ['on' => false, 'switchable' => true], 'email' => ['on' => true, 'switchable' => false]],
        ], $settings['categories']);
    }

    #[Test]
    public function aSwitchSavesAndTheWorkerHonoursIt(): void
    {
        $saved = $this->as($this->owner, 'PUT', '/api/auth/notification-settings', ['category' => 'event_changes', 'channel' => 'email', 'on' => false]);
        self::assertSame(200, $this->statusCode(), Json\encode($saved));
        self::assertSame(['on' => false, 'switchable' => true], Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($saved['categories'])[3]['email']);

        $this->notify('quiet', null);

        self::assertSame(['in_app'], Type\vec(Type\string())->coerce(self::connection()->fetchFirstColumn('SELECT channel FROM notification_deliveries')));
    }

    #[Test]
    public function accountAndSecurityEmailCannotBeSwitchedOff(): void
    {
        $this->as($this->owner, 'PUT', '/api/auth/notification-settings', ['category' => 'account_security', 'channel' => 'email', 'on' => false]);

        self::assertSame(422, $this->statusCode());
        self::assertTrue(Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->as($this->owner, 'GET', '/api/auth/notification-settings')['categories'])[5]['email']['on']);
    }

    #[Test]
    public function inTheAppIsNotASwitch(): void
    {
        $this->as($this->owner, 'PUT', '/api/auth/notification-settings', ['category' => 'messages', 'channel' => 'in_app', 'on' => false]);

        self::assertSame(422, $this->statusCode());
    }

    #[Test]
    public function muteThisEventIsTheCallersOwnAndShowsOnItsItems(): void
    {
        $event = $this->event();
        $path = '/api/events/' . $event->getId()->toRfc4122() . '/mute';
        self::assertSame(['muted' => false], $this->as($this->owner, 'GET', $path));

        self::assertSame(['muted' => true], $this->as($this->owner, 'PUT', $path, ['muted' => true]));
        self::assertSame(['muted' => true], $this->as($this->owner, 'GET', $path));
        $this->notify('muted', $event);

        self::assertTrue(self::items($this->as($this->owner, 'GET', '/api/notifications'))[0]['muted']);
        self::assertSame(['muted' => false], $this->as($this->owner, 'PUT', $path, ['muted' => false]));
        self::assertFalse(self::items($this->as($this->owner, 'GET', '/api/notifications'))[0]['muted']);
    }

    #[Test]
    public function somebodyOutsideTheEventCannotMuteIt(): void
    {
        $stranger = self::service(UserRegistrar::class)->register('tomi@example.com', 'Tomi', self::PASSWORD)->user;
        self::onboard($stranger);

        $this->as($stranger, 'PUT', '/api/events/' . $this->event()->getId()->toRfc4122() . '/mute', ['muted' => true]);

        self::assertSame(404, $this->statusCode());
        self::assertSame(0, Type\int()->coerce(self::connection()->fetchOne('SELECT COUNT(*) FROM event_mutes')));
    }

    private function notify(string $line, ?Event $event): void
    {
        self::service(NotificationScheduler::class)->schedule(
            'test.bell',
            'bell:' . $line,
            'bell-' . $line,
            Trigger::at(new DateTimeImmutable('-1 minute')),
            Audience::membersWithPermission($this->organisation->getId(), Permission::EventsRead),
            ['line' => $line, 'place' => '/events/x'],
            $event,
        );

        $steps = 0;

        while ($steps < 100 && self::service(NotificationWorker::class)->step()) {
            ++$steps;
        }
    }

    private function event(): Event
    {
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $starts = new DateTimeImmutable('+10 days', new DateTimeZone('Africa/Lagos'))->setTime(18, 0);
        $event = new Event($organisation, 'Gala', EventType::Wedding, $starts, $starts->modify('+5 hours'), 'NGN');
        self::em()->persist($event);
        self::em()->flush();

        return $event;
    }

    private static function connection(): Connection
    {
        return self::service(Connection::class);
    }

    /**
     * @param array<string, mixed> $feed
     *
     * @return list<array<string, mixed>>
     */
    private static function items(array $feed): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($feed['items']);
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
        ], content: null === $body ? null : Json\encode($body));
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
