<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Event;
use App\Entity\Organisation;
use App\Entity\PhoneNumber;
use App\Entity\ShiftAttendance;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Entity\User;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\ReadsSentPhoneCodes;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

final class WhosHereTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use ReadsSentPhoneCodes;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    /** @var array<string, string> by name */
    private array $jobs = [];

    /** @var array<string, string> by name */
    private array $places = [];

    private string $dayo;

    private string $grace;

    private string $tope;

    private string $ngozi;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-06T14:00:00Z'));
        $this->owner = $this->account('owner@ire.events', 'Ifeoma Nduka');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent();

        foreach (['Floor lead', 'Waiter', 'Door'] as $job) {
            $this->jobs[$job] = $this->newJob($job);
        }

        $this->dayo = $this->person('Dayo Okafor', 'Floor lead', '0803 111 0001');
        $this->grace = $this->person('Grace Okon', 'Waiter', '0803 111 0002');
        $this->tope = $this->person('Tope Bello', 'Waiter', '0803 111 0003');
        $this->ngozi = $this->person('Ngozi Eze', 'Waiter', null);
        $this->onShift([$this->dayo], 'Floor lead', '2027-03-06T16:00', '2027-03-07T02:00');
        $this->onShift([$this->grace, $this->tope, $this->ngozi], 'Waiter', '2027-03-06T17:00', '2027-03-07T01:00');
        $this->places = $this->places();
        $this->station($this->grace, 'Bar');
        $this->station($this->tope, 'Bar');
        $this->station($this->ngozi, 'Door');
        $this->as($this->owner, 'PUT', $this->staff('stations/floor-lead'), ['lead' => $this->dayo]);
        $this->as($this->owner, 'PUT', $this->staff('stations/' . $this->places['Bar'] . '/lead'), ['lead' => $this->grace]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->clockIn($this->dayo, '2027-03-06T15:00:00Z');
        $this->clockIn($this->grace, '2027-03-06T16:50:00Z');
        self::mockTime(new DateTimeImmutable('2027-03-06T17:05:00Z'));
    }

    #[Test]
    public function theListsReadClockInsAndNothingElse(): void
    {
        $read = $this->as($this->owner, 'GET', $this->path());
        self::assertSame(200, $this->statusCode(), Json\encode($read));

        self::assertSame(['Ngozi Eze', 'Tope Bello'], $this->names($read['notHere']), 'oldest start first, then by name');
        self::assertSame(['Grace Okon', 'Dayo Okafor'], $this->names($read['here']), 'latest clock-in first');
        self::assertSame([], $read['didntClockIn']);

        $grace = $this->row($read['here'], 'Grace Okon');
        self::assertSame(['Waiter', 'Bar', '2027-03-06T17:00:00+01:00', '2027-03-07T01:00:00+01:00', '2027-03-06T17:50:00+01:00', '+2348031110002'], [$grace['job'], $this->stationName($grace), $grace['shiftStartsAt'], $grace['shiftEndsAt'], $grace['clockedInAt'], $grace['phone']]);

        $tope = $this->row($read['notHere'], 'Tope Bello');
        $ngozi = $this->row($read['notHere'], 'Ngozi Eze');
        self::assertSame([false, null], [$tope['nobodyHere'], $tope['clockedInAt']], 'Grace is here on the Bar');
        self::assertSame([true, null, true], [$ngozi['nobodyHere'], $ngozi['phone'], $ngozi['canAddMobile']], 'nobody is here on the Door, and the owner manages staff');

        $bar = Iter\search(Type\vec(Type\shape(['name' => Type\string(), 'people' => Type\vec(Type\string())], true))->coerce($read['stations']), static fn (array $one): bool => 'Bar' === $one['name']);
        self::assertSame(['Grace Okon'], $bar['people'] ?? null);
        self::assertSame(['shift', '2027-03-07T01:00:00+01:00'], $this->jobEnd($read, 'Waiter'), 'the latest Waiter shift ending in the next 24 hours');
        self::assertSame(['event', '2027-03-07T02:00:00+01:00'], $this->jobEnd($read, 'Door'), 'Door has no shift tonight, and the event ends first');
        self::assertSame([false, true, null], [$read['ended'], $this->viewer($read)['canCover'], $this->viewer($read)['station']]);
    }

    #[Test]
    public function someoneDueInFifteenMinutesIsNotHereYetAndANoShowMovesToDidntClockInOnceTheShiftEnds(): void
    {
        $late = $this->person('Femi Ade', 'Waiter', '0803 111 0005');
        $this->onShift([$late], 'Waiter', '2027-03-06T18:20', '2027-03-07T01:00');
        $later = $this->person('Bola Ade', 'Waiter', '0803 111 0006');
        $this->onShift([$later], 'Waiter', '2027-03-06T18:21', '2027-03-07T01:00');

        self::assertContains('Femi Ade', $this->names($this->as($this->owner, 'GET', $this->path())['notHere']));
        self::assertNotContains('Bola Ade', $this->names($this->last()['notHere']), 'sixteen minutes away');

        self::mockTime(new DateTimeImmutable('2027-03-07T00:10:00Z'));
        $read = $this->as($this->owner, 'GET', $this->path());
        self::assertSame([], $read['notHere']);
        self::assertSame(['Bola Ade', 'Femi Ade', 'Ngozi Eze', 'Tope Bello'], Vec\sort($this->names($read['didntClockIn'])));
        self::assertSame(['Grace Okon', 'Dayo Okafor'], $this->names($read['here']), 'never clocked out, still able to');
    }

    #[Test]
    public function aStationLeadSeesTheirStationAloneTheFloorLeadEveryoneAndNobodyElseAnything(): void
    {
        $grace = $this->signedIn($this->grace, '+2348031110002');
        $read = $this->as($grace, 'GET', $this->path());
        self::assertSame(200, $this->statusCode(), Json\encode($read));
        self::assertSame([['Tope Bello'], ['Grace Okon'], [], 'Bar', false], [$this->names($read['notHere']), $this->names($read['here']), $read['stations'], Type\shape(['name' => Type\string()], true)->coerce($this->viewer($read)['station'])['name'], $this->viewer($read)['canCover']]);

        $this->as($grace, 'POST', $this->path('cover'), ['absent' => $this->tope, 'mover' => $this->dayo]);
        self::assertSame(403, $this->statusCode(), 'Cover moves someone off another station');

        $dayo = $this->signedIn($this->dayo, '+2348031110001');
        $read = $this->as($dayo, 'GET', $this->path());
        self::assertSame([['Ngozi Eze', 'Tope Bello'], true, null], [$this->names($read['notHere']), $this->viewer($read)['canCover'], $this->viewer($read)['station']]);

        $tope = $this->signedIn($this->tope, '+2348031110003');
        $this->as($tope, 'GET', $this->path());
        self::assertSame([403, 'permission_required'], [$this->statusCode(), $this->errorCode()]);
        $this->as($tope, 'POST', $this->path('walk-ons'), ['fullName' => 'Someone', 'job' => $this->jobs['Waiter'], 'station' => $this->places['Bar']]);
        self::assertSame(403, $this->statusCode());
        $this->as($tope, 'POST', $this->path('subscriptions'));
        self::assertSame(403, $this->statusCode());
    }

    #[Test]
    public function aStationLeadAddsAWalkOnToTheirOwnStationAndGivesThemANumberAfterwards(): void
    {
        $grace = $this->signedIn($this->grace, '+2348031110002');
        $added = $this->as($grace, 'POST', $this->path('walk-ons'), ['fullName' => '  Oluwafunmilayo Bankole ', 'mobile' => null, 'job' => $this->jobs['Waiter'], 'station' => $this->places['Door']]);
        self::assertSame(201, $this->statusCode(), Json\encode($added));
        self::assertSame([null, null, 'Oluwafunmilayo Bankole'], [$added['url'], $added['phone'], Type\shape(['name' => Type\string()], true)->coerce($added['staff'])['name']]);
        $walkOn = Type\shape(['id' => Type\string()], true)->coerce($added['staff'])['id'];

        $row = $this->row($this->as($grace, 'GET', $this->path())['notHere'], 'Oluwafunmilayo Bankole');
        self::assertSame(['Bar', '2027-03-06T18:05:00+01:00', '2027-03-07T01:00:00+01:00', true], [$this->stationName($row), $row['shiftStartsAt'], $row['shiftEndsAt'], $row['canAddMobile']], 'on her own station, from now to the latest Waiter end');

        $dayo = $this->signedIn($this->dayo, '+2348031110001');
        self::assertFalse($this->row($this->as($dayo, 'GET', $this->path())['notHere'], 'Oluwafunmilayo Bankole')['canAddMobile'], 'not the lead who added her, and no staff.manage');
        self::assertFalse($this->row($this->last()['notHere'], 'Ngozi Eze')['canAddMobile']);
        $this->as($dayo, 'PUT', $this->path('people/' . $walkOn . '/mobile'), ['mobile' => ['countryCode' => 'NG', 'number' => '0803 555 0144']]);
        self::assertSame(403, $this->statusCode());

        $this->as($grace, 'PUT', $this->path('people/' . $walkOn . '/mobile'), ['mobile' => ['countryCode' => 'NG', 'number' => '']]);
        self::assertSame([422, ['mobile']], [$this->statusCode(), $this->fields($this->last()['violations'] ?? null)]);
        $this->as($grace, 'PUT', $this->path('people/' . $this->ngozi . '/mobile'), ['mobile' => ['countryCode' => 'NG', 'number' => '0803 555 0145']]);
        self::assertSame(403, $this->statusCode(), 'a staffer she did not add');

        $linked = $this->as($grace, 'PUT', $this->path('people/' . $walkOn . '/mobile'), ['mobile' => ['countryCode' => 'NG', 'number' => '0803 555 0144']]);
        self::assertSame(200, $this->statusCode(), Json\encode($linked));
        self::assertSame('+2348035550144', $linked['phone']);
        self::assertTrue(Str\contains(Type\string()->coerce($linked['url']), '/'));
        self::assertSame('+2348035550144', $this->entry($walkOn)->getMobile());

        $audited = Vec\map(self::em()->getRepository(AuditEntry::class)->findBy(['subjectId' => $this->entry($walkOn)->getId()]), static fn (AuditEntry $entry): array => [$entry->getAction(), $entry->getActorLabel(), Json\encode($entry->getChanges())]);
        self::assertContains(['staff.walked_on', 'Grace Okon', '[]'], $audited);
        self::assertContains(['staff.mobile_added', 'Grace Okon', '[]'], $audited);
        self::assertFalse(Str\contains(Json\encode($audited), '555'), 'never the number');
    }

    #[Test]
    public function aWalkOnWithANumberGetsTheirLinkAndAShiftToTheEventsEndWhenTheirJobHasNone(): void
    {
        $dayo = $this->signedIn($this->dayo, '+2348031110001');
        $added = $this->as($dayo, 'POST', $this->path('walk-ons'), ['fullName' => 'Kunle Ade', 'mobile' => ['countryCode' => 'NG', 'number' => '0803 555 0177'], 'job' => $this->jobs['Door'], 'station' => $this->places['Door']]);
        self::assertSame(201, $this->statusCode(), Json\encode($added));
        self::assertSame('+2348035550177', $added['phone']);
        self::assertNotNull($added['url']);

        $row = $this->row($this->as($dayo, 'GET', $this->path())['notHere'], 'Kunle Ade');
        self::assertSame(['Door', 'Door', '2027-03-07T02:00:00+01:00', '+2348035550177', true], [$row['job'], $this->stationName($row), $row['shiftEndsAt'], $row['phone'], $row['nobodyHere']], 'nobody has clocked in on the Door');
    }

    #[Test]
    public function aWalkOnNeedsANameAJobAndAStationAndAMobileThatFitsTheCountry(): void
    {
        $dayo = $this->signedIn($this->dayo, '+2348031110001');
        $this->as($dayo, 'POST', $this->path('walk-ons'), ['fullName' => ' ', 'mobile' => null, 'job' => null, 'station' => null]);
        self::assertSame([422, ['fullName', 'job', 'station']], [$this->statusCode(), $this->fields($this->last()['violations'] ?? null)]);

        $this->as($dayo, 'POST', $this->path('walk-ons'), ['fullName' => 'Kunle Ade', 'mobile' => ['countryCode' => 'NG', 'number' => '0803 555 01'], 'job' => $this->jobs['Door'], 'station' => $this->places['Door']]);
        self::assertSame([422, ['mobile']], [$this->statusCode(), $this->fields($this->last()['violations'] ?? null)]);
        self::assertNull(self::em()->getRepository(StaffMember::class)->findOneBy(['fullName' => 'Kunle Ade']), 'nothing was added');
    }

    #[Test]
    public function onceTheEventHasEndedNobodyIsAddedAtTheDoor(): void
    {
        $this->event()->end(new DateTimeImmutable('2027-03-06T17:00:00Z'));
        self::em()->flush();
        $dayo = $this->signedIn($this->dayo, '+2348031110001');

        self::assertTrue($this->as($this->owner, 'GET', $this->path())['ended']);
        $this->as($dayo, 'POST', $this->path('walk-ons'), ['fullName' => 'Kunle Ade', 'mobile' => null, 'job' => $this->jobs['Door'], 'station' => $this->places['Door']]);
        self::assertContains($this->statusCode(), [404, 409], Json\encode($this->last()));

        $this->as($this->owner, 'POST', $this->path('walk-ons'), ['fullName' => 'Kunle Ade', 'mobile' => null, 'job' => $this->jobs['Door'], 'station' => $this->places['Door']]);
        self::assertSame([409, 'event_concluded'], [$this->statusCode(), $this->errorCode()]);
    }

    #[Test]
    public function coverMovesSomeoneHereOntoTheAbsentPersonsStationAndTheyKeepTheirShift(): void
    {
        $dayo = $this->signedIn($this->dayo, '+2348031110001');
        $this->as($dayo, 'POST', $this->path('cover'), ['absent' => $this->ngozi, 'mover' => $this->tope]);
        self::assertSame([422, ['mover']], [$this->statusCode(), $this->fields($this->last()['violations'] ?? null)], 'Tope has not clocked in');
        $this->as($dayo, 'POST', $this->path('cover'), ['absent' => $this->tope, 'mover' => $this->grace]);
        self::assertSame([422, ['mover']], [$this->statusCode(), $this->fields($this->last()['violations'] ?? null)], 'already on the Bar');

        $read = $this->as($dayo, 'POST', $this->path('cover'), ['absent' => $this->ngozi, 'mover' => $this->grace]);
        self::assertSame(200, $this->statusCode(), Json\encode($read));
        $ngozi = $this->row($read['notHere'], 'Ngozi Eze');
        $grace = $this->row($read['here'], 'Grace Okon');
        $tope = $this->row($read['notHere'], 'Tope Bello');
        self::assertSame(['Grace Okon', false, 'Door'], [$ngozi['coveredBy'], $ngozi['nobodyHere'], $this->stationName($ngozi)], 'Ngozi keeps her place');
        self::assertSame(['Door', ['station' => 'Bar', 'at' => '2027-03-06T18:05:00+01:00']], [$this->stationName($grace), $grace['movedFrom']]);
        self::assertTrue($tope['nobodyHere'], 'nobody here on the Bar now');
        self::assertNull($this->entry($this->grace)->getStation()?->getLead(), 'she no longer leads the Bar');

        $this->as($this->owner, 'PUT', $this->staff('stations/people/' . $this->grace), ['station' => $this->places['Bar']]);
        $read = $this->as($this->owner, 'GET', $this->path());
        self::assertSame([null, null], [$this->row($read['here'], 'Grace Okon')['movedFrom'], $this->row($read['notHere'], 'Ngozi Eze')['coveredBy']], 'a move from Stations ends the cover');
    }

    /**
     * @param array<string, mixed> $read
     *
     * @return array{0: string, 1: string}
     */
    private function jobEnd(array $read, string $name): array
    {
        $jobs = Type\vec(Type\shape(['name' => Type\string(), 'walkOnEnd' => Type\string(), 'walkOnEndsAt' => Type\string()], true))->coerce($read['jobs']);
        $job = Iter\search($jobs, static fn (array $one): bool => $name === $one['name']) ?? self::fail('no job ' . $name);

        return [$job['walkOnEnd'], $job['walkOnEndsAt']];
    }

    /** @return array<string, mixed> */
    private function viewer(mixed $read): array
    {
        return Type\shape(['viewer' => Type\dict(Type\string(), Type\mixed())], true)->coerce($read)['viewer'];
    }

    /** @return list<string> */
    private function names(mixed $rows): array
    {
        return Vec\map(Type\vec(Type\shape(['name' => Type\string()], true))->coerce($rows), static fn (array $row): string => $row['name']);
    }

    /** @return array<string, mixed> */
    private function row(mixed $rows, string $name): array
    {
        return Iter\search(Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($rows), static fn (array $row): bool => $name === $row['name']) ?? self::fail('no row for ' . $name);
    }

    /** @param array<string, mixed> $row */
    private function stationName(array $row): ?string
    {
        return Type\nullable(Type\shape(['name' => Type\string()], true))->coerce($row['station'])['name'] ?? null;
    }

    /** @return list<string> */
    private function fields(mixed $violations): array
    {
        return Vec\map(Type\vec(Type\shape(['propertyPath' => Type\string()], true))->coerce($violations), static fn (array $one): string => $one['propertyPath']);
    }

    /** @return array<string, string> */
    private function places(): array
    {
        $places = Type\shape(['places' => Type\vec(Type\shape(['id' => Type\string(), 'name' => Type\string()], true))], true)->coerce($this->as($this->owner, 'GET', $this->staff(''))['stations'] ?? null)['places'];
        $byName = [];

        foreach ($places as $place) {
            $byName[$place['name']] = $place['id'];
        }

        return $byName;
    }

    private function station(string $staffId, string $place): void
    {
        $this->as($this->owner, 'PUT', $this->staff('stations/people/' . $staffId), ['station' => $this->places[$place]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function clockIn(string $staffId, string $at): void
    {
        $entry = $this->entry($staffId);
        $shift = Iter\search(self::em()->getRepository(StaffShift::class)->findAll(), static fn (StaffShift $one): bool => Iter\contains($one->getPeople(), $entry)) ?? self::fail('no shift');
        $attendance = new ShiftAttendance($shift, $entry);
        $attendance->clockIn(new DateTimeImmutable($at));
        self::em()->persist($attendance);
        self::em()->flush();
    }

    private function signedIn(string $staffId, string $number): User
    {
        $link = $this->as($this->owner, 'POST', $this->staff('staff/' . $staffId . '/link'));
        self::assertSame(200, $this->statusCode(), Json\encode($link));
        $token = Str\after_last(Type\string()->coerce($link['url'] ?? null), '/') ?? self::fail('no token');
        $this->post('/api/staff-links/sign-in/send', ['token' => $token]);
        $handle = Type\string()->coerce($this->last()['handle'] ?? null);
        $this->post('/api/staff-links/sign-in', ['token' => $token, 'handle' => $handle, 'code' => $this->codeTo($number)]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::em()->clear();

        return self::em()->getRepository(PhoneNumber::class)->findOneBy(['number' => $number])?->getUser() ?? self::fail('no account');
    }

    private function event(): Event
    {
        return self::em()->find(Event::class, $this->eventId) ?? self::fail('no event');
    }

    private function entry(string $staffId): StaffMember
    {
        return self::em()->find(StaffMember::class, $staffId) ?? self::fail('no entry');
    }

    /** @param list<string> $people */
    private function onShift(array $people, string $job, string $startsAt, string $endsAt): void
    {
        $this->as($this->owner, 'POST', $this->staff('staff/shifts'), ['job' => $this->jobs[$job], 'startsAt' => $startsAt, 'endsAt' => $endsAt, 'needed' => Iter\count($people)]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $shifts = Type\vec(Type\shape(['id' => Type\string(), 'job' => Type\string(), 'startsAt' => Type\string(), 'endsAt' => Type\string()], true))->coerce($this->last()['shifts'] ?? null);
        $shift = Iter\search($shifts, fn (array $one): bool => $this->jobs[$job] === $one['job'] && Str\starts_with($one['startsAt'], $startsAt) && Str\starts_with($one['endsAt'], $endsAt)) ?? self::fail('no shift');

        foreach ($people as $person) {
            $this->as($this->owner, 'PUT', $this->staff('staff/shifts/' . $shift['id'] . '/people/' . $person));
            self::assertLessThan(300, $this->statusCode(), Json\encode($this->last()));
        }
    }

    private function person(string $name, string $job, ?string $mobile): string
    {
        $this->as($this->owner, 'POST', $this->staff('staff'), ['fullName' => $name, 'job' => $this->jobs[$job], 'mobile' => null === $mobile ? null : ['countryCode' => 'NG', 'number' => $mobile]]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        return Type\shape(['id' => Type\string()], true)->coerce($this->last()['staff'] ?? null)['id'];
    }

    private function newJob(string $name): string
    {
        $this->as($this->owner, 'POST', $this->staff('staff/jobs'), ['name' => $name, 'access' => 'floor']);
        self::assertContains($this->statusCode(), [201, 422], Json\encode($this->last()));
        $listed = $this->as($this->owner, 'GET', $this->staff('staff'));
        $jobs = Type\vec(Type\shape(['id' => Type\string(), 'name' => Type\string()], true))->coerce($listed['jobs'] ?? null);

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

    private function path(string $rest = ''): string
    {
        return '/api/events/' . $this->eventId . '/whos-here' . ('' === $rest ? '' : '/' . $rest);
    }

    private function staff(string $rest): string
    {
        return '/api/events/' . $this->eventId . ('' === $rest ? '/staff' : '/' . $rest);
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

    private function errorCode(): ?string
    {
        $type = $this->last()['type'] ?? null;

        return \is_string($type) ? Str\after_last($type, '/') : null;
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
