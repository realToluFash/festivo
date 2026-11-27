<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\EventPerson;
use App\Entity\Guest;
use App\Entity\GuestNeed;
use App\Entity\MenuCourse;
use App\Entity\Organisation;
use App\Entity\PhoneNumber;
use App\Entity\ScheduleItem;
use App\Entity\SeatAssignment;
use App\Entity\SeatingPlan;
use App\Entity\SeatingSection;
use App\Entity\SeatingTable;
use App\Entity\StaffItemStation;
use App\Entity\StaffMember;
use App\Entity\StaffStation;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\NeedKind;
use App\Enum\SectionColour;
use App\Enum\StationKind;
use App\Enum\TableShape;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\ReadsSentPhoneCodes;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

final class MyNightTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use ReadsSentPhoneCodes;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string NUMBER = '+2348031110009';

    private const string LEAD_NUMBER = '+2348031110010';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    private string $jobId;

    private string $grace;

    private string $dayo;

    private ?string $token = null;

    private bool $onAShift = false;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-06T18:40:00Z'));
        $this->owner = $this->account('owner@ire.events', 'Ifeoma Nduka');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent();
        $this->jobId = $this->newJob('Waiter');
        $this->grace = $this->person('Grace Okon', '0803 111 0009');
        $this->dayo = $this->person('Dayo Okafor', '0803 111 0010');
        $this->onShift($this->dayo, '2027-03-06T17:00', '2027-03-07T01:00');
    }

    #[Test]
    public function theirOwnAccountReadsTheirStationShiftLeadTimingAndTablesAndNothingElse(): void
    {
        $this->seatedSection(withLead: true);
        $this->moment('Staff briefing', '2027-03-06T18:30', false);
        $this->moment('Dinner is served', '2027-03-06T20:00', true);
        $night = $this->night($this->signedIn());

        self::assertSame(200, $this->statusCode(), Json\encode($night));
        self::assertSame(['pastAccess', 'clock', 'event', 'endsAt', 'station', 'job', 'shift', 'later', 'lead', 'timing', 'doorsAt', 'tables', 'checksIn', 'dishes', 'floor', 'whosHere', 'rules'], Vec\keys($night));
        self::assertFalse($night['whosHere'], 'a waiter who leads nothing does not read Who\'s here');
        self::assertSame(['id' => $this->eventId, 'name' => 'Owambe', 'timeZone' => 'Africa/Lagos'], $night['event']);
        self::assertFalse($night['checksIn']);
        self::assertFalse($night['dishes'], 'a section station dishes nothing');
        self::assertTrue($night['floor'], "a Waiter's Can work the floor on a section station opens it");
        self::assertSame('2027-03-07T02:00:00+01:00', $night['endsAt'], "the event's end, before 2 hours after the last shift");
        self::assertSame(['Section B', 'Waiter'], [$night['station'], $night['job']]);
        self::assertSame(['job' => 'Waiter', 'startsAt' => '2027-03-06T17:00:00+01:00', 'endsAt' => '2027-03-07T01:00:00+01:00'], $night['shift']);
        self::assertNull($night['later']);
        self::assertSame(['name' => 'Dayo Okafor', 'phone' => self::LEAD_NUMBER, 'floor' => false], $night['lead']);
        self::assertSame([
            ['at' => '2027-03-06T18:30:00+01:00', 'title' => 'Staff briefing', 'for' => 'staff'],
            ['at' => '2027-03-06T20:00:00+01:00', 'title' => 'Dinner is served', 'for' => 'guests'],
        ], $night['timing']);
        self::assertSame('2027-03-06T16:00:00+01:00', $night['doorsAt']);
        self::assertSame([[
            'name' => 'Table 7',
            'guests' => [
                ['name' => 'Folake Adeyemi', 'allergens' => ['other'], 'diets' => ['vegetarian'], 'otherAllergy' => 'Kiwi', 'otherDiet' => null],
                ['name' => 'Chidi Nwosu', 'allergens' => [], 'diets' => [], 'otherAllergy' => null, 'otherDiet' => null],
            ],
        ]], $night['tables']);
    }

    #[Test]
    public function aJobAtCanCheckGuestsInSaysSoAndOneAtCanViewDoesNot(): void
    {
        $user = $this->signedIn();
        self::assertFalse($this->night($user)['checksIn'] ?? null);

        $this->as($this->owner, 'PUT', $this->path('jobs/' . $this->jobId), ['name' => 'Waiter', 'access' => 'check_in']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::em()->clear();

        self::assertTrue($this->night($user)['checksIn'] ?? null);
    }

    #[Test]
    public function aStationThatDishesSaysSoOnlyToAnAccountThatOpensTheKitchenStations(): void
    {
        $user = $this->signedIn();
        $event = $this->event();
        $course = new MenuCourse($event, 'Main', null, 0);
        $course->listOwnItems(['Jollof rice']);
        $grill = new StaffStation($event, StationKind::Place, 'Grill', 'grill', null, 1);
        $bar = new StaffStation($event, StationKind::Place, 'Bar', 'bar', null, 2);
        $pass = self::em()->getRepository(StaffStation::class)->findOneBy(['event' => $event, 'kind' => StationKind::Pass]) ?? self::fail('every event has its Pass');
        $grant = EventPerson::outside($event, $user, EventRole::CanWorkPass, null, null);
        foreach ([$course, $grill, $bar, $grant, new StaffItemStation($course, 'jollof rice', $grill)] as $row) {
            self::em()->persist($row);
        }
        self::em()->flush();
        $this->putOn($grill);

        self::assertTrue($this->night($user)['dishes'] ?? null, 'the Grill dishes the jollof');

        $this->putOn($pass);
        self::assertTrue($this->night($user)['dishes'] ?? null, 'the Pass is a kitchen station');

        $this->putOn($bar);
        self::assertFalse($this->night($user)['dishes'] ?? null, 'the Bar dishes nothing');

        $this->putOn(null);
        self::assertFalse($this->night($user)['dishes'] ?? null, 'on no station');

        $this->putOn($grill);
        $grant = self::em()->find(EventPerson::class, $grant->getId()) ?? self::fail('no grant');
        $grant->setRole(EventRole::CanWorkFloor);
        self::em()->flush();
        self::assertFalse($this->night($user)['dishes'] ?? null, 'the floor alone does not open the stations');

        self::em()->remove(self::em()->find(EventPerson::class, $grant->getId()) ?? self::fail('no grant'));
        self::em()->flush();
        self::assertFalse($this->night($user)['dishes'] ?? null, "a staff link's own level does not open them");

        $this->as($this->owner, 'PUT', $this->path('jobs/' . $this->jobId), ['name' => 'Waiter', 'access' => 'pass']);
        self::assertTrue($this->night($user)['dishes'] ?? null, "a job's Can work the pass opens them through the staff link");
    }

    #[Test]
    public function aSectionStationWorksTheFloorOnlyForAnAccountWhoseAccessOpensIt(): void
    {
        $user = $this->signedIn();
        $this->seatedSection(withLead: false);
        $section = self::em()->getRepository(StaffStation::class)->findOneBy(['event' => $this->event(), 'kind' => StationKind::Section]) ?? self::fail('no section station');
        $grill = new StaffStation($this->event(), StationKind::Place, 'Grill', 'grill', null, 2);
        self::em()->persist($grill);
        self::em()->flush();

        foreach (['view' => false, 'check_in' => false, 'pass' => false, 'floor' => true, 'run' => true] as $access => $opens) {
            $this->as($this->owner, 'PUT', $this->path('jobs/' . $this->jobId), ['name' => 'Waiter', 'access' => $access]);
            self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
            self::em()->clear();
            self::assertSame($opens, $this->night($user)['floor'] ?? null, "a job's {$access} through the staff link");
        }

        $this->as($this->owner, 'PUT', $this->path('jobs/' . $this->jobId), ['name' => 'Waiter', 'access' => 'view']);
        self::em()->clear();
        foreach ([[EventRole::Lead, true], [EventRole::CanEdit, true], [EventRole::CanRunFloor, true], [EventRole::CanWorkFloor, true], [EventRole::CanWorkPass, false], [EventRole::CanCheckIn, false]] as [$role, $opens]) {
            $grant = EventPerson::outside($this->event(), self::em()->find(User::class, $user->getId()) ?? self::fail('no account'), $role, null, null);
            self::em()->persist($grant);
            self::em()->flush();
            self::assertSame($opens, $this->night($user)['floor'] ?? null, $role->value . ' granted on the event');
            self::em()->remove(self::em()->find(EventPerson::class, $grant->getId()) ?? self::fail('no grant'));
            self::em()->flush();
        }

        $this->as($this->owner, 'PUT', $this->path('jobs/' . $this->jobId), ['name' => 'Waiter', 'access' => 'floor']);
        self::em()->clear();
        $this->putOn($grill);
        self::assertFalse($this->night($user)['floor'] ?? null, 'a kitchen station is not the floor');

        $this->putOn(null);
        self::assertFalse($this->night($user)['floor'] ?? null, 'on no station');

        $this->putOn($section);
        self::assertTrue($this->night($user)['floor'] ?? null, 'back on the section');
    }

    #[Test]
    public function noGuestContactAndNoOtherStaffMemberReachThePage(): void
    {
        $this->seatedSection(withLead: true);
        $raw = Json\encode($this->night($this->signedIn()));

        foreach (['folake@example.com', '0803 555', '+234803555', 'Kemi Adeyinka', self::NUMBER, 'step_free'] as $absent) {
            self::assertFalse(Str\contains($raw, $absent), $absent . ' reached the page');
        }
    }

    #[Test]
    public function anyoneButTheEntrysOwnAccountIsAnsweredAsForALinkThatDoesNotExist(): void
    {
        $user = $this->signedIn();
        $token = $this->link($this->grace, fresh: false);

        $this->post('/api/staff-links/night', ['token' => $token]);
        self::assertSame(404, $this->statusCode(), 'signed out');

        foreach ([$this->owner, $this->account('sam@okafor.ng', 'Samuel Okafor')] as $other) {
            $this->as($other, 'POST', '/api/staff-links/night', ['token' => $token]);
            self::assertSame(404, $this->statusCode(), 'another account');
            $this->as($other, 'GET', '/api/events/' . $this->eventId . '/my-night');
            self::assertSame(404, $this->statusCode(), 'another account in the app');
        }

        $this->as($user, 'GET', '/api/events/' . $this->eventId . '/my-night');
        self::assertSame(200, $this->statusCode(), 'their own account in the app');
        self::assertSame('Waiter', $this->last()['job'] ?? null);
    }

    #[Test]
    public function theNightEndsTwoHoursAfterTheLastShiftWhenTheEventEndsLaterAndFollowsAMovedEnd(): void
    {
        $user = $this->signedIn();
        $event = self::em()->find(Event::class, $this->eventId) ?? self::fail('no event');
        $event->setTimes($event->getStartsAt(), new DateTimeImmutable('2027-03-07T04:00:00+01:00'));
        self::em()->flush();

        self::assertSame('2027-03-07T03:00:00+01:00', $this->night($user)['endsAt']);

        $event = self::em()->find(Event::class, $this->eventId) ?? self::fail('no event');
        $event->setTimes($event->getStartsAt(), new DateTimeImmutable('2027-03-07T00:00:00+01:00'));
        self::em()->flush();

        self::assertSame('2027-03-07T00:00:00+01:00', $this->night($user)['endsAt']);
    }

    #[Test]
    public function onceTheLinksWindowHasEndedTheNightIsGone(): void
    {
        $user = $this->signedIn();
        self::mockTime(new DateTimeImmutable('2027-03-07T02:00:00Z'));

        $this->night($user);

        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function beforeDoorsTheTablesAreEmptyAndNoGuestIsNamed(): void
    {
        $this->seatedSection(withLead: true);
        $user = $this->signedIn();
        self::mockTime(new DateTimeImmutable('2027-03-06T12:00:00Z'));

        $night = $this->night($user);

        self::assertSame(200, $this->statusCode(), Json\encode($night));
        self::assertSame([], $night['tables']);
        self::assertFalse(Str\contains(Json\encode($night), 'Folake'));
    }

    #[Test]
    public function theFloorLeadAndAStationsLeadAreToldTheyReadWhosHere(): void
    {
        $this->seatedSection(withLead: false);
        $user = $this->signedIn();
        self::assertFalse($this->night($user)['whosHere'] ?? null, 'on a station they do not lead');

        $this->entry($this->grace)->setFloorLead(true);
        self::em()->flush();
        self::assertTrue($this->night($user)['whosHere'] ?? null, 'the floor lead reads the whole floor');

        $grace = $this->entry($this->grace);
        $grace->setFloorLead(false);
        $grace->getStation()?->setLead($grace);
        self::em()->flush();
        self::assertTrue($this->night($user)['whosHere'] ?? null, "a station's lead reads their own station");
    }

    #[Test]
    public function withNoStationLeadTheFloorLeadStandsInAndWithNeitherThereIsNone(): void
    {
        $this->seatedSection(withLead: false);
        $user = $this->signedIn();

        self::assertNull($this->night($user)['lead']);

        $this->entry($this->dayo)->setFloorLead(true);
        self::em()->flush();

        self::assertSame(['name' => 'Dayo Okafor', 'phone' => self::LEAD_NUMBER, 'floor' => true], $this->night($user)['lead']);
    }

    #[Test]
    public function withNoStationTheJobHeadsAndThereIsNoTablesSection(): void
    {
        $night = $this->night($this->signedIn());

        self::assertSame([null, 'Waiter', null], [$night['station'], $night['job'], $night['tables']]);
    }

    #[Test]
    public function withTwoShiftsTheCurrentOneShowsAndTheNextIsLater(): void
    {
        $this->onShift($this->grace, '2027-03-06T17:00', '2027-03-06T22:00');
        $this->onShift($this->grace, '2027-03-06T23:00', '2027-03-07T01:00');
        $night = $this->night($this->signedIn());

        self::assertSame('2027-03-06T17:00:00+01:00', Type\shape(['startsAt' => Type\string()], true)->coerce($night['shift'])['startsAt']);
        self::assertSame(['job' => 'Waiter', 'startsAt' => '2027-03-06T23:00:00+01:00'], $night['later']);
    }

    #[Test]
    public function aMoveToAnotherStationIsReadOnTheNextRequest(): void
    {
        $this->seatedSection(withLead: true);
        $user = $this->signedIn();
        $other = new StaffStation($this->event(), StationKind::Place, 'Bar', 'bar', null, 1);
        self::em()->persist($other);
        $this->entry($this->grace)->setStation($other);
        self::em()->flush();

        $night = $this->night($user);

        self::assertSame(['Bar', null], [$night['station'], $night['tables']]);
    }

    /** Section B, with Grace on it, Dayo its lead or not, and Table 7 seating two named guests, a removed one and Kemi, who is staff elsewhere. */
    private function seatedSection(bool $withLead): void
    {
        $event = $this->event();
        $plan = new SeatingPlan($event, null, 1000, 1000, null);
        $section = new SeatingSection($plan, 'Section B', 'section b', SectionColour::Blue, null);
        $station = new StaffStation($event, StationKind::Section, 'Section B', 'section b', $section, 1);
        $table = new SeatingTable($plan, 'Table 7', 'table 7', TableShape::Round, 100, 100, null);
        $table->setSection($section);
        $elsewhere = new SeatingTable($plan, 'Table 9', 'table 9', TableShape::Round, 300, 100, null);
        foreach ([$plan, $section, $station, $table, $elsewhere] as $row) {
            self::em()->persist($row);
        }

        $grace = $this->entry($this->grace);
        $grace->setStation($station);
        $station->setLead($withLead ? $this->entry($this->dayo) : null);
        $this->entry($this->dayo)->setStation($station);

        $folake = $this->guest($event, 'Folake Adeyemi', 'folake@example.com', '+2348035550001');
        $folake->setOther(NeedKind::Allergen, 'Kiwi');
        self::em()->persist(new GuestNeed($folake, NeedKind::Diet, 'vegetarian'));
        self::em()->persist(new GuestNeed($folake, NeedKind::Allergen, 'other'));
        self::em()->persist(new GuestNeed($folake, NeedKind::Access, 'step_free'));
        self::em()->persist(new SeatAssignment($folake, $table, 1));
        self::em()->persist(new SeatAssignment($this->guest($event, 'Chidi Nwosu', null, null), $table, 2));
        self::em()->persist(new SeatAssignment($this->guest($event, 'Kemi Adeyinka', null, null), $elsewhere, 1));
        self::em()->flush();
    }

    private function guest(Event $event, string $name, ?string $email, ?string $mobile): Guest
    {
        $guest = Guest::listed($event, $name, Str\lowercase($name), $email, $mobile, null, SecureRandom\string(32), SecureRandom\string(6, '0123456789'));
        self::em()->persist($guest);

        return $guest;
    }

    private function moment(string $title, string $wall, bool $toGuests): void
    {
        $item = new ScheduleItem($this->event(), $title, new DateTimeImmutable($wall . ':00Z'), null);
        $item->describe($title, new DateTimeImmutable($wall . ':00Z'), null, null, null, null, null, false, $toGuests, null);
        self::em()->persist($item);
        self::em()->flush();
    }

    private function putOn(?StaffStation $station): void
    {
        $this->entry($this->grace)->setStation(null === $station ? null : self::em()->find(StaffStation::class, $station->getId()));
        self::em()->flush();
    }

    /** @return array<string, mixed> */
    private function night(User $user): array
    {
        return $this->as($user, 'POST', '/api/staff-links/night', ['token' => $this->link($this->grace, fresh: false)]);
    }

    private function signedIn(): User
    {
        if (!$this->onAShift) {
            $this->onShift($this->grace, '2027-03-06T17:00', '2027-03-07T01:00');
        }

        $token = $this->link($this->grace);
        $this->post('/api/staff-links/sign-in/send', ['token' => $token]);
        $handle = Type\string()->coerce($this->last()['handle'] ?? null);
        $this->post('/api/staff-links/sign-in', ['token' => $token, 'handle' => $handle, 'code' => $this->codeTo(self::NUMBER)]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::em()->clear();

        return self::em()->getRepository(PhoneNumber::class)->findOneBy(['number' => self::NUMBER])?->getUser() ?? self::fail('no account');
    }

    private function link(string $staffId, bool $fresh = true): string
    {
        if (!$fresh && null !== $this->token) {
            return $this->token;
        }

        $answer = $this->as($this->owner, 'POST', $this->path($staffId . '/link'));
        self::assertSame(200, $this->statusCode(), Json\encode($answer));

        return $this->token = Str\after_last(Type\string()->coerce($answer['url'] ?? null), '/') ?? self::fail('no token');
    }

    private function event(): Event
    {
        return self::em()->find(Event::class, $this->eventId) ?? self::fail('no event');
    }

    private function entry(string $staffId): StaffMember
    {
        return self::em()->find(StaffMember::class, $staffId) ?? self::fail('no entry');
    }

    private function onShift(string $staffId, string $startsAt, string $endsAt): void
    {
        $this->onAShift = $this->onAShift || $staffId === $this->grace;
        $this->as($this->owner, 'POST', $this->path('shifts'), ['job' => $this->jobId, 'startsAt' => $startsAt, 'endsAt' => $endsAt, 'needed' => 2]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $shifts = Type\vec(Type\shape(['id' => Type\string(), 'startsAt' => Type\string()], true))->coerce($this->last()['shifts'] ?? null);
        $shift = Iter\search($shifts, static fn (array $one): bool => Str\starts_with($one['startsAt'], $startsAt) && Str\starts_with(Type\string()->coerce($one['endsAt'] ?? null), $endsAt)) ?? self::fail('no shift');
        $this->as($this->owner, 'PUT', $this->path('shifts/' . $shift['id'] . '/people/' . $staffId));
        self::assertLessThan(300, $this->statusCode(), Json\encode($this->last()));
    }

    private function person(string $name, string $mobile): string
    {
        $this->as($this->owner, 'POST', $this->path(''), ['fullName' => $name, 'job' => $this->jobId, 'mobile' => ['countryCode' => 'NG', 'number' => $mobile]]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        return Type\shape(['id' => Type\string()], true)->coerce($this->last()['staff'] ?? null)['id'];
    }

    /** The event's own job of that name, or a new one. */
    private function newJob(string $name): string
    {
        $this->as($this->owner, 'POST', $this->path('jobs'), ['name' => $name, 'access' => 'view']);
        self::assertContains($this->statusCode(), [201, 422], Json\encode($this->last()));
        $jobs = Type\vec(Type\shape(['id' => Type\string(), 'name' => Type\string()], true))->coerce($this->as($this->owner, 'GET', $this->path(''))['jobs'] ?? null);

        return (Iter\search($jobs, static fn (array $job): bool => $name === $job['name']) ?? self::fail('no job ' . $name))['id'];
    }

    private function newEvent(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2027-03-06T16:00',
            'endsAt' => '2027-03-07T02:00',
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function path(string $rest): string
    {
        return '' === $rest ? '/api/events/' . $this->eventId . '/staff' : '/api/events/' . $this->eventId . '/staff/' . $rest;
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    /** @param array<string, mixed> $body */
    private function post(string $path, array $body): void
    {
        $this->client->request('POST', $path, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode($body));
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, #[SensitiveParameter] ?array $body = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ], content: null === $body ? null : Json\encode($body));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
