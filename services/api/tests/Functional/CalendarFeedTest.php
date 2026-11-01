<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Event\CalendarFeed\FeedLinkIssuer;
use App\Domain\Event\Timeline\Model\Milestone;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\MembershipStatus;
use App\Enum\MilestoneOwner;
use App\Enum\Permission;
use App\Enum\PermissionArea;
use App\Tests\ApiTestCase;
use App\Tests\Double\RefusingRateLimiterFactory;
use App\Tests\Double\ScriptedMilestones;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Monolog\Handler\TestHandler;
use Monolog\Level;
use Monolog\Logger;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Sabre\VObject\Component;
use Sabre\VObject\Component\VCalendar;
use Sabre\VObject\Component\VEvent;
use Sabre\VObject\Property;
use Sabre\VObject\Property\ICalendar\DateTime;
use Sabre\VObject\Reader;
use Symfony\Component\RateLimiter\LimiterInterface;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\RateLimiter\Storage\InMemoryStorage;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Subscribe in your calendar app (sc-3626): the link, the feed a calendar app fetches, and who stops getting it. */
final class CalendarFeedTest extends ApiTestCase
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
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
    }

    #[Test]
    public function theFeedValidatesAsICalendarWithEachEventOnceItsMilestonesAndItsZone(): void
    {
        $id = $this->create('Boda en Madrid', '2026-10-24T18:00', '2026-10-26T02:00', 'Europe/Madrid');
        $this->balanceDue($id, '2026-10-20T12:00:00+02:00');
        self::service(Connection::class)->executeStatement("UPDATE events SET venue_name = 'Finca La Concepción', venue_address = 'Calle Mayor 1, 28013 Madrid, Spain' WHERE id = :id", ['id' => $id]);
        $this->create('Adé at 40', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');

        $body = $this->fetch($this->link($this->owner));

        self::assertSame(200, $this->statusCode());
        self::assertSame('text/calendar; charset=utf-8', $this->client->getResponse()->headers->get('Content-Type'));
        $calendar = $this->parse($body);
        self::assertSame([], Vec\filter($calendar->validate(), static fn (array $warning): bool => $warning['level'] > 1), 'RFC 5545 warnings');
        self::assertSame(['Africa/Lagos', 'Europe/Madrid'], Vec\map(Vec\filter(Vec\values($calendar->select('VTIMEZONE')), static fn (mixed $zone): bool => $zone instanceof Component), static fn (Component $zone): string => self::value($zone, 'TZID')));
        self::assertSame([
            ['Boda en Madrid', '2026-10-24T18:00:00+02:00', 'Europe/Madrid'],
            ['Balance due', '2026-10-20T12:00:00+02:00', 'Europe/Madrid'],
            ['Adé at 40', '2030-11-14T16:00:00+01:00', 'Africa/Lagos'],
        ], Vec\map($this->events($calendar), static fn (VEvent $event): array => [self::value($event, 'SUMMARY'), self::start($event), self::zoneOf($event)]));

        $wedding = $this->event($calendar, 'event-' . $id . '@soirely');
        self::assertSame('Finca La Concepción, Calle Mayor 1, 28013 Madrid, Spain', self::value($wedding, 'LOCATION'));
        self::assertSame('2026-10-26T02:00:00+01:00', self::moment($wedding, 'DTEND'));
        self::assertSame("Status: Draft\nOpen in Soirely: https://app.soirely.test/app/events/" . $id, self::value($wedding, 'DESCRIPTION'));
        self::assertSame('CONFIRMED', self::value($wedding, 'STATUS'));
        self::assertSame("Open in Soirely: https://app.soirely.test/app/events/{$id}/dates", self::value($this->event($calendar, 'milestone-' . $id . '-budget.balance@soirely'), 'DESCRIPTION'));
    }

    #[Test]
    public function aMovedDateUpdatesInPlaceUnderTheSameUidWithAHigherSequence(): void
    {
        $id = $this->create('Owambe', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');
        $this->balanceDue($id, '2030-11-10T12:00:00+01:00');
        $path = $this->link($this->owner);
        $before = $this->event($this->parse($this->fetch($path)), 'event-' . $id . '@soirely');

        $this->move($id, '2030-11-21T16:00', '2030-11-21T23:00');
        $after = $this->event($this->parse($this->fetch($path)), 'event-' . $id . '@soirely');

        self::assertSame('2030-11-14T16:00:00+01:00', self::start($before));
        self::assertSame('2030-11-21T16:00:00+01:00', self::start($after));
        self::assertGreaterThan((int) self::value($before, 'SEQUENCE'), (int) self::value($after, 'SEQUENCE'));
        $milestone = $this->event($this->parse($this->fetch($path)), 'milestone-' . $id . '-budget.balance@soirely');
        self::assertSame('2030-11-10T12:00:00+01:00', self::start($milestone));
        self::assertSame(self::value($after, 'SEQUENCE'), self::value($milestone, 'SEQUENCE'));
    }

    #[Test]
    public function aPausedEventSaysItIsPaused(): void
    {
        $id = $this->create('Owambe', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');
        self::service(Connection::class)->executeStatement("UPDATE events SET status = 'paused', made_live_at = '2030-10-01 09:00:00', paused_at = '2030-10-02 09:00:00' WHERE id = :id", ['id' => $id]);
        self::em()->clear();

        $event = $this->event($this->parse($this->fetch($this->link($this->owner))), 'event-' . $id . '@soirely');

        self::assertSame('Owambe (paused)', self::value($event, 'SUMMARY'));
        self::assertStringStartsWith('Status: Paused', self::value($event, 'DESCRIPTION'));
        self::assertSame('CONFIRMED', self::value($event, 'STATUS'));
    }

    #[Test]
    public function aCalledOffEventIsCancelledForThirtyDaysAndThenDropped(): void
    {
        $recent = $this->create('Recent', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');
        $old = $this->create('Old', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');
        $this->endAt($recent, new DateTimeImmutable('-29 days'));
        $this->endAt($old, new DateTimeImmutable('-31 days'));

        $calendar = $this->parse($this->fetch($this->link($this->owner)));

        $cancelled = $this->event($calendar, 'event-' . $recent . '@soirely');
        self::assertSame('CANCELLED', self::value($cancelled, 'STATUS'));
        self::assertStringStartsWith('Status: Called off', self::value($cancelled, 'DESCRIPTION'));
        self::assertSame(['event-' . $recent . '@soirely'], $this->uids($calendar), 'a cancelled event carries no milestones, and the older one is gone');
    }

    #[Test]
    public function aDeletedEventIsCancelledForThirtyDaysAndThenDropped(): void
    {
        $id = $this->create('Owambe', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');
        $path = $this->link($this->owner);
        $before = $this->event($this->parse($this->fetch($path)), 'event-' . $id . '@soirely');

        $this->request($this->owner, 'DELETE', '/api/events/' . $id, ['name' => 'Owambe']);
        self::assertSame(200, $this->statusCode(), (string) $this->client->getResponse()->getContent());
        $deleted = $this->event($this->parse($this->fetch($path)), 'event-' . $id . '@soirely');

        self::assertSame('CANCELLED', self::value($deleted, 'STATUS'));
        self::assertGreaterThan((int) self::value($before, 'SEQUENCE'), (int) self::value($deleted, 'SEQUENCE'));

        self::service(Connection::class)->executeStatement("UPDATE events SET deleted_at = NOW() - INTERVAL '31 days' WHERE id = :id", ['id' => $id]);
        self::em()->clear();

        self::assertSame([], $this->uids($this->parse($this->fetch($path))));
    }

    #[Test]
    public function theFeedHoldsNoPeopleAndNoMoney(): void
    {
        $id = $this->create('Adé at 40', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');
        $this->patch($id, ['hosts' => ['Chief Adébáyọ̀ Ọlábísí', 'Mrs Fúnmi Ọlábísí']]);
        $this->member('planner@ire.events', $this->role('Planner', [Permission::EventsRead]));

        $body = $this->fetch($this->link($this->owner));

        foreach (['Adébáyọ̀', 'Fúnmi', 'owner@ire.events', 'planner@ire.events', 'Person', 'NGN', '₦'] as $private) {
            self::assertStringNotContainsString($private, $body);
        }
        self::assertSame(['ATTENDEE', 'ORGANIZER', 'CONTACT'], Vec\filter(['ATTENDEE', 'ORGANIZER', 'CONTACT'], static fn (string $property): bool => !Str\contains($body, "\n" . $property)));
        self::assertNotNull($this->event($this->parse($body), 'event-' . $id . '@soirely'));
    }

    #[Test]
    public function aMemberSeesOnlyTheMilestonesTheirRoleReadsAndOnlyThisOrganisation(): void
    {
        $id = $this->create('Owambe', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');
        $this->balanceDue($id, '2030-11-10T12:00:00+01:00');
        $eventsOnly = $this->member('events@ire.events', $this->role('Events only', [Permission::EventsRead]));
        $stranger = $this->account('stranger@elsewhere.events');
        $elsewhere = self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->create('Their party', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos', $stranger, $elsewhere);

        self::assertSame(['Owambe', 'Balance due'], $this->summaries($this->link($this->owner)));
        self::assertSame(['Owambe'], $this->summaries($this->link($eventsOnly)));
    }

    #[Test]
    public function resetStopsTheOldLinkAtOnceAndShowsTheNewOne(): void
    {
        $this->create('Owambe', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');
        $old = $this->link($this->owner);
        self::assertSame($old, $this->link($this->owner), 'the panel shows the same link each time it opens');

        $reset = $this->request($this->owner, 'POST', $this->panel() . '/reset');
        self::assertSame(200, $this->statusCode());
        $new = Type\shape(['path' => Type\string()])->coerce($reset)['path'];

        self::assertNotSame($old, $new);
        self::assertSame($new, $this->link($this->owner));
        $this->fetch($old);
        self::assertSame(404, $this->statusCode());
        $this->fetch($new);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function aMemberWhoLosesAccessGetsANotFoundOnTheNextFetch(): void
    {
        $this->create('Owambe', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');
        $role = $this->role('Planner', [Permission::EventsRead]);
        $planner = $this->member('planner@ire.events', $role);
        $path = $this->link($planner);
        $connection = self::service(Connection::class);

        $this->fetch($path);
        self::assertSame(200, $this->statusCode());

        $connection->executeStatement("UPDATE memberships SET status = 'suspended' WHERE user_id = :user", ['user' => $planner->getId()->toRfc4122()]);
        $this->fetch($path);
        self::assertSame(404, $this->statusCode(), 'suspended');

        $connection->executeStatement("UPDATE memberships SET status = 'active' WHERE user_id = :user", ['user' => $planner->getId()->toRfc4122()]);
        $this->fetch($path);
        self::assertSame(200, $this->statusCode(), 'back again');

        $connection->executeStatement("UPDATE roles SET permissions = '[\"guests.read\"]' WHERE id = :role", ['role' => $role->getId()->toRfc4122()]);
        self::em()->clear();
        $this->fetch($path);
        self::assertSame(404, $this->statusCode(), 'without events.read');

        $connection->executeStatement("UPDATE roles SET permissions = '[\"events.read\"]' WHERE id = :role", ['role' => $role->getId()->toRfc4122()]);
        $connection->executeStatement("UPDATE memberships SET status = 'left_or_removed' WHERE user_id = :user", ['user' => $planner->getId()->toRfc4122()]);
        self::em()->clear();
        $this->fetch($path);
        self::assertSame(404, $this->statusCode(), 'left');
    }

    #[Test]
    public function aDeletedAccountsLinkIsNotFound(): void
    {
        $planner = $this->member('planner@ire.events', $this->role('Planner', [Permission::EventsRead]));
        $path = $this->link($planner);

        self::service(Connection::class)->executeStatement('UPDATE users SET deleted_at = NOW() WHERE id = :user', ['user' => $planner->getId()->toRfc4122()]);
        self::em()->clear();
        $this->fetch($path);

        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function theLinksTokenIsLongRandomAndStoredOnlyAsAHash(): void
    {
        $path = $this->link($this->owner);
        $other = $this->link($this->member('planner@ire.events', $this->role('Planner', [Permission::EventsRead])));
        $token = Str\strip_suffix(Str\strip_prefix($path, FeedLinkIssuer::PATH), FeedLinkIssuer::SUFFIX);

        self::assertMatchesRegularExpression('/^[A-Za-z0-9_-]{43}$/', $token, '256 bits, base64url');
        self::assertNotSame($path, $other);
        $rows = self::service(Connection::class)->fetchAllAssociative('SELECT seed, token_hash FROM calendar_feeds');
        self::assertCount(2, $rows);
        self::assertContains(\hash('sha256', $token), Vec\map($rows, static fn (array $row): mixed => $row['token_hash']));
        self::assertStringNotContainsString($token, Json\encode($rows));
    }

    #[Test]
    public function aMatchingETagIsNotModified(): void
    {
        $id = $this->create('Owambe', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');
        $path = $this->link($this->owner);
        $this->fetch($path);
        $tag = (string) $this->client->getResponse()->headers->get('ETag');

        self::assertMatchesRegularExpression('/^"[0-9a-f]{32}"$/', $tag);
        self::assertSame('', $this->fetch($path, $tag));
        self::assertSame(304, $this->statusCode());
        self::assertSame($tag, $this->client->getResponse()->headers->get('ETag'));

        $this->move($id, '2030-11-21T16:00', '2030-11-21T23:00');
        $this->fetch($path, $tag);
        self::assertSame(200, $this->statusCode());
        self::assertNotSame($tag, $this->client->getResponse()->headers->get('ETag'));
    }

    #[Test]
    public function aLinkWithItsBudgetSpentIsRefusedAndOthersAreNot(): void
    {
        $limits = new class implements RateLimiterFactoryInterface {
            public ?string $spent = null;

            public function create(?string $key = null): LimiterInterface
            {
                return $key === $this->spent
                    ? new RefusingRateLimiterFactory()->create($key)
                    : new RateLimiterFactory(['id' => 'calendar_feed_token', 'policy' => 'no_limit'], new InMemoryStorage())->create($key);
            }
        };
        self::getContainer()->set('limiter.calendar_feed_token', $limits);
        $path = $this->link($this->owner);
        $other = $this->link($this->member('planner@ire.events', $this->role('Planner', [Permission::EventsRead])));
        $limits->spent = FeedLinkIssuer::hash(Str\strip_suffix(Str\strip_prefix($path, FeedLinkIssuer::PATH), FeedLinkIssuer::SUFFIX));

        $this->fetch($path);
        self::assertSame(429, $this->statusCode());
        self::assertGreaterThan(0, (int) $this->client->getResponse()->headers->get('Retry-After'));
        $this->fetch($other);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function aLinksBudgetIsSixtyAnHour(): void
    {
        $limiter = self::serviceById('limiter.calendar_feed_token', RateLimiterFactory::class)->create('one-link');

        $accepted = 0;
        while ($limiter->consume()->isAccepted() && $accepted < 500) {
            ++$accepted;
        }

        self::assertSame(60, $accepted);
    }

    #[Test]
    public function thePanelNeedsEventsRead(): void
    {
        $guestsOnly = $this->member('guests@ire.events', $this->role('Guests only', [Permission::GuestsRead]));

        $this->request($guestsOnly, 'GET', $this->panel());
        self::assertSame(403, $this->statusCode());
        $this->request($guestsOnly, 'POST', $this->panel() . '/reset');
        self::assertSame(403, $this->statusCode());
    }

    #[Test]
    public function theTokenIsInNoLogRecordAFetchWrites(): void
    {
        $path = $this->link($this->owner);
        $token = Str\slice(Str\after($path, FeedLinkIssuer::PATH) ?? '', 0, 43);
        $records = new TestHandler();
        foreach (['logger', 'monolog.logger.request'] as $channel) {
            self::serviceById($channel, Logger::class)->pushHandler($records);
        }

        $this->fetch($path);

        self::assertSame(200, $this->statusCode());
        self::assertTrue($records->hasRecordThatContains('Matched route', Level::Info), 'the router logged nothing, so nothing was checked');
        foreach ($records->getRecords() as $record) {
            self::assertStringNotContainsString($token, Json\encode([$record->message, $record->context, $record->extra]));
        }
    }

    #[Test]
    public function anUnknownLinkIsNotFound(): void
    {
        $this->fetch(FeedLinkIssuer::PATH . Str\repeat('A', 43) . FeedLinkIssuer::SUFFIX);

        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function theFeedIsWrittenInTheAccountsLanguage(): void
    {
        $this->owner->setLocale('es');
        self::em()->flush();
        $id = $this->create('Boda', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');
        $translator = self::service(TranslatorInterface::class);
        self::service(ScriptedMilestones::class)->addRead($id, static fn (): Milestone => new Milestone('budget.balance', new DateTimeImmutable('2030-11-10T12:00:00+01:00'), $translator->trans('timeline.event_starts', ['{name}' => 'Boda']), null, MilestoneOwner::You, PermissionArea::Budget));

        self::assertContains('Empieza Boda', $this->summaries($this->link($this->owner)));
    }

    private function balanceDue(string $eventId, string $at): void
    {
        self::service(ScriptedMilestones::class)->add($eventId, new Milestone('budget.balance', new DateTimeImmutable($at), 'Balance due', null, MilestoneOwner::You, PermissionArea::Budget));
    }

    private function create(string $name, string $startsAt, string $endsAt, string $timeZone, ?User $by = null, ?Organisation $in = null): string
    {
        $organisation = $in ?? $this->organisation;
        $body = $this->request($by ?? $this->owner, 'POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', [
            'name' => $name,
            'type' => 'party',
            'startsAt' => $startsAt,
            'endsAt' => $endsAt,
            'timeZone' => $timeZone,
            'currency' => 'NGN',
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['event' => Type\shape(['id' => Type\string()], true)], true)->coerce($body)['event']['id'];
    }

    private function move(string $eventId, string $startsAt, string $endsAt): void
    {
        $this->patch($eventId, ['startsAt' => $startsAt, 'endsAt' => $endsAt]);
    }

    /** @param array<string, mixed> $changes */
    private function patch(string $eventId, array $changes): void
    {
        $this->request($this->owner, 'GET', '/api/events/' . $eventId);
        $tag = (string) $this->client->getResponse()->headers->get('ETag');
        $this->request($this->owner, 'PATCH', '/api/events/' . $eventId, $changes, ['HTTP_IF_MATCH' => $tag]);
        self::assertSame(200, $this->statusCode(), (string) $this->client->getResponse()->getContent());
    }

    private function endAt(string $eventId, DateTimeImmutable $at): void
    {
        self::service(Connection::class)->executeStatement("UPDATE events SET status = 'ended', made_live_at = :at, ended_at = :at WHERE id = :id", [
            'at' => $at->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'),
            'id' => $eventId,
        ]);
        self::em()->clear();
    }

    private function panel(): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/calendar-feed';
    }

    private function link(User $user): string
    {
        $body = $this->request($user, 'GET', $this->panel());
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\shape(['path' => Type\string()])->coerce($body)['path'];
    }

    private function fetch(string $path, ?string $ifNoneMatch = null): string
    {
        $this->client->request('GET', $path, server: null === $ifNoneMatch ? [] : ['HTTP_IF_NONE_MATCH' => $ifNoneMatch]);

        return (string) $this->client->getResponse()->getContent();
    }

    private function parse(string $body): VCalendar
    {
        self::assertSame(200, $this->statusCode(), $body);
        $calendar = Reader::read($body);
        self::assertInstanceOf(VCalendar::class, $calendar);

        return $calendar;
    }

    /** @return list<VEvent> */
    private function events(VCalendar $calendar): array
    {
        $events = [];

        foreach ($calendar->select('VEVENT') as $event) {
            if ($event instanceof VEvent) {
                $events[] = $event;
            }
        }

        return $events;
    }

    private static function property(Component $component, string $name): ?Property
    {
        foreach ($component->select($name) as $property) {
            if ($property instanceof Property) {
                return $property;
            }
        }

        return null;
    }

    private static function value(Component $component, string $name): string
    {
        return self::property($component, $name)?->__toString() ?? '';
    }

    private static function moment(VEvent $event, string $name): string
    {
        $property = self::property($event, $name);
        self::assertInstanceOf(DateTime::class, $property);

        return $property->getDateTime()->format(\DATE_ATOM);
    }

    private static function zoneOf(VEvent $event): string
    {
        $property = self::property($event, 'DTSTART');
        self::assertNotNull($property);

        return (string) $property['TZID'];
    }

    /** @return list<string> */
    private function uids(VCalendar $calendar): array
    {
        return Vec\map($this->events($calendar), static fn (VEvent $event): string => self::value($event, 'UID'));
    }

    private function event(VCalendar $calendar, string $uid): VEvent
    {
        foreach ($this->events($calendar) as $event) {
            if (self::value($event, 'UID') === $uid) {
                return $event;
            }
        }

        self::fail('No VEVENT ' . $uid . ' in ' . Json\encode($this->uids($calendar)));
    }

    /** @return list<string> */
    private function summaries(string $path): array
    {
        return Vec\map($this->events($this->parse($this->fetch($path))), static fn (VEvent $event): string => self::value($event, 'SUMMARY'));
    }

    private static function start(VEvent $event): string
    {
        return self::moment($event, 'DTSTART');
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    /** @param list<Permission> $permissions */
    private function role(string $name, array $permissions): Role
    {
        return Role::custom(self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation'), $name, $permissions);
    }

    private function member(string $address, Role $role): User
    {
        $user = $this->account($address);
        self::em()->persist($role);
        self::em()->persist(new Membership($role->getOrganisation(), $user, $role, MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        return $user;
    }

    /**
     * @param array<string, mixed>|null $body
     * @param array<string, string>     $headers
     *
     * @return array<string, mixed>
     */
    private function request(User $user, string $method, string $path, ?array $body = null, array $headers = []): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            ...$headers,
        ], content: null === $body ? null : Json\encode($body));
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }
}
