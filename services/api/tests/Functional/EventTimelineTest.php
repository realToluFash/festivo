<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Event\Timeline\Model\Milestone;
use App\Domain\Event\Timeline\Model\MilestoneAction;
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
use App\Tests\Double\ScriptedMilestones;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Psl\Vec;

final class EventTimelineTest extends ApiTestCase
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
    public function aOneDayEventHasItsStartAlone(): void
    {
        $id = $this->create('Adé at 40', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');

        self::assertSame([
            'timeZone' => 'Africa/Lagos',
            'milestones' => [
                ['at' => '2030-11-14T16:00:00+01:00', 'title' => 'Adé at 40 starts', 'note' => null, 'owner' => 'event', 'area' => 'events', 'action' => null],
            ],
        ], $this->timeline($this->owner, $id));
    }

    #[Test]
    public function anEventCrossingAChangeOfClocksCarriesEachDatesOwnOffset(): void
    {
        $id = $this->create('Boda en Madrid', '2026-10-24T18:00', '2026-10-26T02:00', 'Europe/Madrid');

        $timeline = $this->timeline($this->owner, $id);

        self::assertSame('Europe/Madrid', $timeline['timeZone']);
        self::assertSame([
            ['2026-10-24T18:00:00+02:00', 'Boda en Madrid starts'],
            ['2026-10-26T02:00:00+01:00', 'Boda en Madrid ends'],
        ], Vec\map($timeline['milestones'], static fn (array $milestone): array => [$milestone['at'], $milestone['title']]));
    }

    #[Test]
    public function milestonesFromEveryAreaAreMergedEarliestFirst(): void
    {
        $id = $this->create('Owambe', '2030-11-14T16:00', '2030-11-16T02:00', 'Africa/Lagos');
        $this->add($id, '2030-11-15T09:00:00+01:00', 'Seating locked', PermissionArea::Seating, MilestoneOwner::Automatic);
        $this->add($id, '2030-11-01T12:00:00+00:00', 'Final numbers to the kitchen', PermissionArea::Menu, MilestoneOwner::You, new MilestoneAction('Open the menu', '/app/events/' . $id . '/menu'));
        $this->add($id, '2030-11-16T02:00:00+01:00', 'Balance due', PermissionArea::Budget, MilestoneOwner::You);

        $milestones = $this->timeline($this->owner, $id)['milestones'];

        self::assertSame([
            ['2030-11-01T13:00:00+01:00', 'Final numbers to the kitchen', 'menu'],
            ['2030-11-14T16:00:00+01:00', 'Owambe starts', 'events'],
            ['2030-11-15T09:00:00+01:00', 'Seating locked', 'seating'],
            ['2030-11-16T02:00:00+01:00', 'Owambe ends', 'events'],
            ['2030-11-16T02:00:00+01:00', 'Balance due', 'budget'],
        ], Vec\map($milestones, static fn (array $milestone): array => [$milestone['at'], $milestone['title'], $milestone['area']]));
        self::assertSame(['label' => 'Open the menu', 'link' => '/app/events/' . $id . '/menu'], $milestones[0]['action']);
    }

    #[Test]
    public function aMemberSeesOnlyTheAreasTheirRoleReads(): void
    {
        $id = $this->create('Owambe', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');
        $this->add($id, '2030-11-10T12:00:00+01:00', 'Seating locked', PermissionArea::Seating, MilestoneOwner::Automatic);
        $this->add($id, '2030-11-12T12:00:00+01:00', 'Balance due', PermissionArea::Budget, MilestoneOwner::You);
        $eventsOnly = $this->member('events@ire.events', Role::custom($this->organisation, 'Events only', [Permission::EventsRead]));
        $seating = $this->member('seating@ire.events', Role::custom($this->organisation, 'Seating', [Permission::EventsRead, Permission::SeatingRead]));

        self::assertSame(['Owambe starts'], $this->titles($eventsOnly, $id));
        self::assertSame(['Seating locked', 'Owambe starts'], $this->titles($seating, $id));
        self::assertSame(['Seating locked', 'Balance due', 'Owambe starts'], $this->titles($this->owner, $id));
    }

    #[Test]
    public function withoutEventsReadThereIsNoTimeline(): void
    {
        $id = $this->create('Owambe', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');
        $guestsOnly = $this->member('guests@ire.events', Role::custom($this->organisation, 'Guests only', [Permission::GuestsRead]));

        $this->as($guestsOnly, '/api/events/' . $id . '/timeline');

        self::assertSame(403, $this->client->getResponse()->getStatusCode());
    }

    #[Test]
    public function anotherOrganisationsEventIsNotFound(): void
    {
        $id = $this->create('Owambe', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');
        $stranger = $this->account('stranger@elsewhere.events');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $theirs = $this->as($stranger, '/api/events/' . $id . '/timeline');
        self::assertSame(404, $this->client->getResponse()->getStatusCode());
        $none = $this->as($stranger, '/api/events/0193f5a8-0000-7000-8000-000000000000/timeline');
        self::assertSame(404, $this->client->getResponse()->getStatusCode());
        self::assertSame([$none['code'] ?? null, $none['detail'] ?? null], [$theirs['code'] ?? null, $theirs['detail'] ?? null]);
    }

    #[Test]
    public function aCalledOffEventHasOneMilestoneWhenItWasCalledOff(): void
    {
        $id = $this->create('Owambe', '2030-11-14T16:00', '2030-11-16T02:00', 'Africa/Lagos');
        $this->end($id, '2030-11-01 09:30:00');

        self::assertSame([
            ['at' => '2030-11-01T10:30:00+01:00', 'title' => 'Owambe called off', 'note' => null, 'owner' => 'event', 'area' => 'events', 'action' => null],
        ], $this->timeline($this->owner, $id)['milestones']);
    }

    #[Test]
    public function aManyDayEventEndedAfterItsStartEndsWhenItWasEnded(): void
    {
        $id = $this->create('Owambe', '2030-11-14T16:00', '2030-11-16T02:00', 'Africa/Lagos');
        $this->end($id, '2030-11-15 08:00:00');

        self::assertSame([
            ['2030-11-14T16:00:00+01:00', 'Owambe starts'],
            ['2030-11-15T09:00:00+01:00', 'Owambe ends'],
        ], $this->dated($this->owner, $id));
    }

    #[Test]
    public function aOneDayEventEndedAfterItsStartHasItsStartAlone(): void
    {
        $id = $this->create('Adé at 40', '2030-11-14T16:00', '2030-11-14T23:00', 'Africa/Lagos');
        $this->end($id, '2030-11-14 18:00:00');

        self::assertSame([['2030-11-14T16:00:00+01:00', 'Adé at 40 starts']], $this->dated($this->owner, $id));
    }

    #[Test]
    public function anEventPastItsEndKeepsItsPlannedDates(): void
    {
        $id = $this->create('Owambe', '2020-11-14T16:00', '2020-11-16T02:00', 'Africa/Lagos');
        self::service(Connection::class)->executeStatement("UPDATE events SET status = 'live', made_live_at = '2020-11-01 09:00:00' WHERE id = :id", ['id' => $id]);

        self::assertSame([
            ['2020-11-14T16:00:00+01:00', 'Owambe starts'],
            ['2020-11-16T02:00:00+01:00', 'Owambe ends'],
        ], $this->dated($this->owner, $id));
    }

    #[Test]
    public function theEventsListCarriesACalledOffEventsTimeline(): void
    {
        $id = $this->create('Owambe', '2030-11-14T16:00', '2030-11-16T02:00', 'Africa/Lagos');
        $this->end($id, '2030-11-01 09:30:00');

        $listed = $this->as($this->owner, '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events?finished=true');
        $events = Type\vec(Type\shape(['id' => Type\string(), 'milestones' => Type\mixed()], true))->coerce($listed['events'] ?? null);
        $titles = Vec\map(Type\vec(Type\shape(['title' => Type\string()], true))->coerce($events[0]['milestones'] ?? null), static fn (array $milestone): string => $milestone['title']);

        self::assertSame([$id], Vec\map($events, static fn (array $event): string => $event['id']));
        self::assertSame(['Owambe called off'], $titles);
        self::assertSame($this->timeline($this->owner, $id)['milestones'], $events[0]['milestones']);
    }

    private function create(string $name, string $startsAt, string $endsAt, string $timeZone): string
    {
        $body = $this->request($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => $name, 'type' => 'party', 'startsAt' => $startsAt, 'endsAt' => $endsAt, 'timeZone' => $timeZone, 'currency' => 'NGN']);
        self::assertSame(201, $this->client->getResponse()->getStatusCode(), Json\encode($body));

        return Type\shape(['event' => Type\shape(['id' => Type\string()], true)], true)->coerce($body)['event']['id'];
    }

    private function add(string $eventId, string $at, string $title, PermissionArea $area, MilestoneOwner $owner, ?MilestoneAction $action = null): void
    {
        self::service(ScriptedMilestones::class)->add($eventId, new Milestone(new DateTimeImmutable($at), $title, null, $owner, $area, $action));
    }

    /** Ended at `$at` UTC, as End now or Call off leaves it (sc-3585), without waiting for the clock. */
    private function end(string $eventId, string $at): void
    {
        self::service(Connection::class)->executeStatement("UPDATE events SET status = 'ended', made_live_at = '2030-10-01 09:00:00', ended_at = :at WHERE id = :id", ['at' => $at, 'id' => $eventId]);
        self::em()->clear();
    }

    /** @return list<array{string, string}> */
    private function dated(User $user, string $eventId): array
    {
        return Vec\map($this->timeline($user, $eventId)['milestones'], static fn (array $milestone): array => [$milestone['at'], $milestone['title']]);
    }

    /** @return list<string> */
    private function titles(User $user, string $eventId): array
    {
        return Vec\map($this->timeline($user, $eventId)['milestones'], static fn (array $milestone): string => $milestone['title']);
    }

    /** @return array{timeZone: string, milestones: list<array{at: string, title: string, note: ?string, owner: string, area: string, action: ?array{label: string, link: string}}>} */
    private function timeline(User $user, string $eventId): array
    {
        $body = $this->as($user, '/api/events/' . $eventId . '/timeline');
        self::assertSame(200, $this->client->getResponse()->getStatusCode(), Json\encode($body));

        return Type\shape([
            'timeZone' => Type\string(),
            'milestones' => Type\vec(Type\shape([
                'at' => Type\string(),
                'title' => Type\string(),
                'note' => Type\nullable(Type\string()),
                'owner' => Type\string(),
                'area' => Type\string(),
                'action' => Type\nullable(Type\shape(['label' => Type\string(), 'link' => Type\string()])),
            ])),
        ])->assert($body);
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, Role $role): User
    {
        $user = $this->account($address);
        self::em()->persist($role);
        self::em()->persist(new Membership($this->organisation, $user, $role, MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        return $user;
    }

    /** @return array<string, mixed> */
    private function as(User $user, string $path): array
    {
        return $this->request($user, 'GET', $path);
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function request(User $user, string $method, string $path, ?array $body = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
        ], content: null === $body ? null : Json\encode($body));
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }
}
