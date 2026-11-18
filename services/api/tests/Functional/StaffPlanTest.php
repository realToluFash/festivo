<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Staff\StaffPlan;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** Jobs and shifts on an event, who fills them, and the roster's Job and Shift (sc-3908). */
final class StaffPlanTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-01T10:00:00Z'));
        $this->owner = $this->account('owner@ire.events', 'Ifeoma Nduka');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent();
    }

    #[Test]
    public function aNewEventStartsWithTheSuggestedJobsAndTheirLevels(): void
    {
        self::assertSame([
            ['Floor lead', 'run'],
            ['Waiter', 'floor'],
            ['Runner', 'floor'],
            ['Bar', 'view'],
            ['Door', 'check_in'],
            ['Kitchen', 'pass'],
            ['Security', 'view'],
            ['Sound', 'view'],
            ['MC', 'view'],
        ], Vec\map($this->plan()['jobs'], static fn (array $job): array => [$job['name'], $job['access']]));
        self::assertSame([], $this->plan()['shifts']);
    }

    #[Test]
    public function aJobIsAddedAfterTheOthersAndRenamed(): void
    {
        $this->as($this->owner, 'POST', $this->path('jobs'), ['name' => '  Cloakroom ', 'access' => 'check_in']);
        self::assertSame(201, $this->statusCode());
        $cloakroom = $this->job('Cloakroom');
        self::assertSame('check_in', $cloakroom['access']);
        self::assertSame('Cloakroom', Iter\last($this->plan()['jobs'])['name'] ?? null);

        $this->as($this->owner, 'PUT', $this->path('jobs/' . $cloakroom['id']), ['name' => 'Coats', 'access' => 'view']);

        self::assertSame(200, $this->statusCode());
        self::assertSame('view', $this->job('Coats')['access']);
    }

    /** @return iterable<string, array{string, string}> */
    public static function badNames(): iterable
    {
        yield 'blank' => ['   ', 'Enter a name for the job.'];
        yield 'over 60' => [Str\repeat('a', 61), 'Keep the name to 60 characters or fewer.'];
        yield 'taken, in another case' => ['waiter', 'This event already has a job called Waiter.'];
        yield 'taken, with accents' => ['Wáìter', 'This event already has a job called Waiter.'];
    }

    #[Test]
    #[DataProvider('badNames')]
    public function aJobNameIsRequiredShortAndUnique(string $name, string $message): void
    {
        $this->as($this->owner, 'POST', $this->path('jobs'), ['name' => $name, 'access' => 'view']);

        self::assertSame(422, $this->statusCode());
        self::assertSame($message, $this->violation('name'));
        self::assertCount(9, $this->plan()['jobs']);
    }

    #[Test]
    public function renamingAJobToItsOwnNameInAnotherCaseIsKept(): void
    {
        $this->as($this->owner, 'PUT', $this->path('jobs/' . $this->job('MC')['id']), ['name' => 'mc', 'access' => 'view']);

        self::assertSame(200, $this->statusCode());
        self::assertSame('mc', $this->job('mc')['name']);
    }

    #[Test]
    public function aJobWithNoShiftsIsRemovedAndItsPeopleKeepNoJob(): void
    {
        $sound = $this->job('Sound');
        $kunle = $this->person('Kunle Ajayi', $sound['id']);

        $this->as($this->owner, 'DELETE', $this->path('jobs/' . $sound['id']));

        self::assertSame(200, $this->statusCode());
        self::assertNull(Iter\search($this->plan()['jobs'], static fn (array $job): bool => 'Sound' === $job['name']));
        self::assertNull($this->staffEntry($kunle)['job']);
    }

    #[Test]
    public function aJobsEmptyShiftsGoWithIt(): void
    {
        $this->shift('MC', '2027-03-06T19:00', '2027-03-06T20:00');

        $this->as($this->owner, 'DELETE', $this->path('jobs/' . $this->job('MC')['id']));

        self::assertSame(200, $this->statusCode());
        self::assertSame([], $this->plan()['shifts']);
    }

    #[Test]
    public function aJobIsNotRemovedWhileAnyoneIsOnItsShifts(): void
    {
        $shift = $this->shift('Bar', '2027-03-06T16:00', '2027-03-07T01:00');
        $this->assign($shift, $this->person('Sade Lawal'));

        $this->as($this->owner, 'DELETE', $this->path('jobs/' . $this->job('Bar')['id']));

        self::assertSame(409, $this->statusCode());
        self::assertSame('staff_job_staffed', $this->code());
        self::assertSame('Unassign its people first.', $this->last()['detail'] ?? null);
        self::assertCount(1, $this->plan()['shifts']);
    }

    #[Test]
    public function aShiftCrossesMidnightAndIsWrittenWithTheEventsOffset(): void
    {
        $shift = $this->shift('Bar', '2027-03-06T16:00', '2027-03-07T01:00', 2);

        self::assertSame('2027-03-06T16:00:00+01:00', $shift['startsAt']);
        self::assertSame('2027-03-07T01:00:00+01:00', $shift['endsAt']);
        self::assertSame(2, $shift['needed']);
        self::assertSame([], $shift['people']);
    }

    #[Test]
    public function aShiftMayStartBeforeTheEventAndEndAfterIt(): void
    {
        $this->shift('Kitchen', '2027-03-06T10:00', '2027-03-07T04:00');

        self::assertSame(201, $this->statusCode());
    }

    /** @return iterable<string, array{array<string, mixed>, string, string}> */
    public static function badShifts(): iterable
    {
        yield 'no job' => [['job' => null], 'job', 'Choose a job.'];
        yield 'no start' => [['startsAt' => ''], 'startsAt', 'Enter the date and time the shift starts.'];
        yield 'no end' => [['endsAt' => '2027-03-07'], 'endsAt', 'Enter the date and time the shift ends.'];
        yield 'an end before the start' => [['endsAt' => '2027-03-06T15:00'], 'endsAt', 'The end must be after the start.'];
        yield 'an end at the start' => [['endsAt' => '2027-03-06T16:00'], 'endsAt', 'The end must be after the start.'];
        yield 'over 24 hours' => [['endsAt' => '2027-03-07T16:30'], 'endsAt', 'A shift can’t be longer than 24 hours. Check the dates.'];
        yield 'nobody needed' => [['needed' => 0], 'needed', 'Enter a number from 1 to 50.'];
        yield 'over 50 needed' => [['needed' => 51], 'needed', 'Enter a number from 1 to 50.'];
    }

    /** @param array<string, mixed> $change */
    #[Test]
    #[DataProvider('badShifts')]
    public function aWrongShiftIsRefusedBesideItsField(array $change, string $field, string $message): void
    {
        $this->as($this->owner, 'POST', $this->path('shifts'), [
            'job' => $this->job('Bar')['id'],
            'startsAt' => '2027-03-06T16:00',
            'endsAt' => '2027-03-07T01:00',
            'needed' => 1,
            ...$change,
        ]);

        self::assertSame(422, $this->statusCode());
        self::assertSame($message, $this->violation($field));
        self::assertSame([], $this->plan()['shifts']);
    }

    #[Test]
    public function aShiftOfExactly24HoursIsKept(): void
    {
        $this->shift('Security', '2027-03-06T12:00', '2027-03-07T12:00');

        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function somebodyWithNoJobTakesTheShiftsJob(): void
    {
        $shift = $this->shift('Waiter', '2027-03-06T17:00', '2027-03-07T00:00', 4);
        $amina = $this->person('Amina Bello');

        $this->assign($shift, $amina);

        self::assertSame(200, $this->statusCode());
        self::assertSame([$amina], $this->shiftOf($shift)['people']);
        self::assertSame('Waiter', $this->staffEntry($amina)['job']['name'] ?? null);
        self::assertSame([$shift['id']], Vec\map(Type\vec(Type\shape(['id' => Type\string()], true))->coerce($this->staffEntry($amina)['shifts']), static fn (array $one): string => $one['id']));
    }

    #[Test]
    public function somebodyWhoseJobIsAnotherIsRefusedBeforeAnyOverlap(): void
    {
        $bar = $this->shift('Bar', '2027-03-06T16:00', '2027-03-07T01:00');
        $door = $this->shift('Door', '2027-03-06T16:30', '2027-03-06T21:00');
        $sade = $this->person('Sade Lawal');
        $this->assign($bar, $sade);

        $this->assign($door, $sade);

        self::assertSame(409, $this->statusCode());
        self::assertSame('staff_works_as', $this->code());
        self::assertSame('Sade Lawal works as Bar on this event.', $this->last()['detail'] ?? null);
        self::assertSame([], $this->shiftOf($door)['people']);
    }

    #[Test]
    public function somebodyOnAnOverlappingShiftOfTheirJobIsRefusedNamingIt(): void
    {
        $first = $this->shift('Bar', '2027-03-06T16:00', '2027-03-07T01:00');
        $second = $this->shift('Bar', '2027-03-06T21:15', '2027-03-06T23:00');
        $sade = $this->person('Sade Lawal');
        $this->assign($first, $sade);

        $this->assign($second, $sade);

        self::assertSame(409, $this->statusCode());
        self::assertSame('staff_shift_overlap', $this->code());
        self::assertSame('Sade Lawal is on Bar from 16:00 to 01:00.', $this->last()['detail'] ?? null);
    }

    #[Test]
    public function overAnEventLongerThan24HoursTheOverlapNamesItsDays(): void
    {
        $first = $this->shift('Bar', '2027-03-06T16:00', '2027-03-07T01:00');
        $this->shift('Bar', '2027-03-08T09:00', '2027-03-08T12:00');
        $second = $this->shift('Bar', '2027-03-06T23:00', '2027-03-07T02:00');
        $sade = $this->person('Sade Lawal');
        $this->assign($first, $sade);

        $this->assign($second, $sade);

        self::assertSame('Sade Lawal is on Bar from Sat 6 Mar, 16:00 to Sun 7 Mar, 01:00.', $this->last()['detail'] ?? null);
    }

    #[Test]
    public function shiftsThatOnlyTouchDoNotOverlap(): void
    {
        $tolu = $this->person('Tolu Bello');
        $this->assign($this->shift('Door', '2027-03-06T16:30', '2027-03-06T21:00'), $tolu);

        $this->assign($this->shift('Door', '2027-03-06T21:00', '2027-03-07T02:00'), $tolu);

        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function aFullShiftTakesNobodyMore(): void
    {
        $shift = $this->shift('MC', '2027-03-06T19:00', '2027-03-06T20:00');
        $this->assign($shift, $this->person('Bisi Ade'));

        $this->assign($shift, $this->person('Tayo Ojo'));

        self::assertSame(409, $this->statusCode());
        self::assertSame('staff_shift_full', $this->code());
        self::assertSame('Every place on this shift is filled. Unassign someone to make room.', $this->last()['detail'] ?? null);
    }

    #[Test]
    public function unassigningLeavesThePlaceOpenAndThePersonTheirJob(): void
    {
        $shift = $this->shift('Runner', '2027-03-06T17:00', '2027-03-07T00:00', 2);
        $ronke = $this->person('Ronke Ade');
        $this->assign($shift, $ronke);

        $this->as($this->owner, 'DELETE', $this->path('shifts/' . $shift['id'] . '/people/' . $ronke));

        self::assertSame(200, $this->statusCode());
        $after = $this->shiftOf($shift);
        self::assertSame([], $after['people']);
        self::assertSame([$shift['job'], $shift['startsAt'], $shift['endsAt'], 2], [$after['job'], $after['startsAt'], $after['endsAt'], $after['needed']]);
        self::assertSame('Runner', $this->staffEntry($ronke)['job']['name'] ?? null);
    }

    #[Test]
    public function editingTimesKeepsThePeople(): void
    {
        $shift = $this->shift('Waiter', '2027-03-06T17:00', '2027-03-07T00:00', 2);
        $grace = $this->person('Grace Okafor');
        $this->assign($shift, $grace);

        $this->as($this->owner, 'PUT', $this->path('shifts/' . $shift['id']), ['startsAt' => '2027-03-06T18:00', 'endsAt' => '2027-03-07T01:00', 'needed' => 3]);

        self::assertSame(200, $this->statusCode());
        $after = $this->shiftOf($shift);
        self::assertSame(['2027-03-06T18:00:00+01:00', 3, [$grace]], [$after['startsAt'], $after['needed'], $after['people']]);
    }

    #[Test]
    public function editingTimesIntoAnOverlapIsRefusedAndTheOldTimesStay(): void
    {
        $tolu = $this->person('Tolu Bello');
        $early = $this->shift('Door', '2027-03-06T16:30', '2027-03-06T21:00');
        $late = $this->shift('Door', '2027-03-06T23:00', '2027-03-07T02:00');
        $this->assign($early, $tolu);
        $this->assign($late, $tolu);

        $this->as($this->owner, 'PUT', $this->path('shifts/' . $late['id']), ['startsAt' => '2027-03-06T20:00', 'endsAt' => '2027-03-07T02:00', 'needed' => 1]);

        self::assertSame(409, $this->statusCode());
        self::assertSame('Tolu Bello is on Door from 16:30 to 21:00.', $this->last()['detail'] ?? null);
        self::assertSame('2027-03-06T23:00:00+01:00', $this->shiftOf($late)['startsAt']);
    }

    #[Test]
    public function peopleNeededBelowThePeopleOnItIsRefusedNamingHowMany(): void
    {
        $shift = $this->shift('Kitchen', '2027-03-06T15:00', '2027-03-06T23:00', 3);
        $this->assign($shift, $this->person('Bisi Ade'));
        $this->assign($shift, $this->person('Tayo Ojo'));

        $this->as($this->owner, 'PUT', $this->path('shifts/' . $shift['id']), ['startsAt' => '2027-03-06T15:00', 'endsAt' => '2027-03-06T23:00', 'needed' => 1]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('2 people are on this shift. Unassign some first, or keep 2 or more.', $this->violation('needed'));
        self::assertSame(2, $this->last()['onShift'] ?? null);
        self::assertSame(3, $this->shiftOf($shift)['needed']);
    }

    #[Test]
    public function addingAPersonGivesThemAJobAndAShift(): void
    {
        $shift = $this->shift('Waiter', '2027-03-06T17:00', '2027-03-07T00:00', 4);

        $this->as($this->owner, 'POST', $this->staff(), ['fullName' => 'Emeka Obi', 'job' => $shift['job'], 'shift' => $shift['id']]);

        self::assertSame(201, $this->statusCode());
        $emeka = Type\shape(['id' => Type\string()], true)->coerce($this->last()['staff'] ?? null)['id'];
        self::assertSame([$emeka], $this->shiftOf($shift)['people']);
        self::assertSame('Waiter', $this->staffEntry($emeka)['job']['name'] ?? null);
    }

    #[Test]
    public function addingAPersonOnAFullShiftIsRefusedAndNobodyIsAdded(): void
    {
        $shift = $this->shift('MC', '2027-03-06T19:00', '2027-03-06T20:00');
        $this->assign($shift, $this->person('Bisi Ade'));

        $this->as($this->owner, 'POST', $this->staff(), ['fullName' => 'Emeka Obi', 'job' => $shift['job'], 'shift' => $shift['id']]);

        self::assertSame(409, $this->statusCode());
        self::assertSame(['Bisi Ade'], Vec\map($this->plan()['staff'], static fn (array $one): mixed => $one['fullName']));
    }

    #[Test]
    public function aPersonOnAShiftCannotChangeJob(): void
    {
        $sade = $this->person('Sade Lawal');
        $this->assign($this->shift('Bar', '2027-03-06T16:00', '2027-03-07T01:00'), $sade);

        $this->as($this->owner, 'PUT', $this->staff($sade), ['fullName' => 'Sade Lawal', 'job' => $this->job('Door')['id']]);

        self::assertSame(409, $this->statusCode());
        self::assertSame('staff_on_shifts', $this->code());
        self::assertSame('Unassign Sade Lawal from their shifts first.', $this->last()['detail'] ?? null);
        self::assertSame('Bar', $this->staffEntry($sade)['job']['name'] ?? null);
    }

    #[Test]
    public function aPersonOnNoShiftChangesJobAndAnEditWithoutAJobKeepsIt(): void
    {
        $kunle = $this->person('Kunle Ajayi', $this->job('Waiter')['id']);

        $this->as($this->owner, 'PUT', $this->staff($kunle), ['fullName' => 'Kunle Ajayi', 'job' => $this->job('Runner')['id']]);
        self::assertSame(200, $this->statusCode());
        $this->as($this->owner, 'PUT', $this->staff($kunle), ['fullName' => 'Kunle A.']);

        self::assertSame('Runner', $this->staffEntry($kunle)['job']['name'] ?? null);
    }

    #[Test]
    public function theRosterRunsByShiftStartThenName(): void
    {
        $this->person('Ada Nnaji');
        $tolu = $this->person('Tolu Bello');
        $bisi = $this->person('Bisi Ade');
        $this->assign($this->shift('Door', '2027-03-06T16:30', '2027-03-06T21:00'), $tolu);
        $this->assign($this->shift('Kitchen', '2027-03-06T15:00', '2027-03-06T23:00'), $bisi);

        self::assertSame(['Bisi Ade', 'Tolu Bello', 'Ada Nnaji'], Vec\map($this->plan()['staff'], static fn (array $one): mixed => $one['fullName']));
    }

    #[Test]
    public function removingAPersonFromTheEventLeavesEachPlaceOpen(): void
    {
        $tolu = $this->person('Tolu Bello');
        $early = $this->shift('Door', '2027-03-06T16:30', '2027-03-06T21:00');
        $late = $this->shift('Door', '2027-03-06T23:00', '2027-03-07T02:00');
        $this->assign($early, $tolu);
        $this->assign($late, $tolu);

        $this->as($this->owner, 'DELETE', $this->staff($tolu));

        self::assertSame(204, $this->statusCode());
        self::assertSame([[], []], [$this->shiftOf($early)['people'], $this->shiftOf($late)['people']]);
        self::assertSame(1, $this->shiftOf($late)['needed']);
    }

    #[Test]
    public function changesAreAudited(): void
    {
        $shift = $this->shift('Bar', '2027-03-06T16:00', '2027-03-07T01:00');
        $this->assign($shift, $this->person('Sade Lawal'));

        $actions = Vec\map(self::em()->getRepository(AuditEntry::class)->findAll(), static fn (AuditEntry $entry): string => $entry->getAction());

        self::assertContains(StaffPlan::SHIFT_ADDED, $actions);
        self::assertContains(StaffPlan::ASSIGNED, $actions);
    }

    #[Test]
    public function canViewSeesJobsAndShiftsButCannotChangeThem(): void
    {
        $shift = $this->shift('Bar', '2027-03-06T16:00', '2027-03-07T01:00');
        $sade = $this->person('Sade Lawal');
        $viewer = $this->member('ada@ire.events', 'Ada Obi', EventRole::CanView);

        $this->as($viewer, 'GET', $this->staff());
        self::assertSame(200, $this->statusCode());

        foreach ([
            ['POST', $this->path('jobs'), ['name' => 'Coats', 'access' => 'view']],
            ['PUT', $this->path('jobs/' . $shift['job']), ['name' => 'Coats', 'access' => 'view']],
            ['DELETE', $this->path('jobs/' . $shift['job']), null],
            ['POST', $this->path('shifts'), ['job' => $shift['job'], 'startsAt' => '2027-03-06T16:00', 'endsAt' => '2027-03-06T18:00', 'needed' => 1]],
            ['PUT', $this->path('shifts/' . $shift['id']), ['startsAt' => '2027-03-06T16:00', 'endsAt' => '2027-03-06T18:00', 'needed' => 1]],
            ['PUT', $this->path('shifts/' . $shift['id'] . '/people/' . $sade), null],
            ['DELETE', $this->path('shifts/' . $shift['id'] . '/people/' . $sade), null],
        ] as [$method, $path, $body]) {
            $this->as($viewer, $method, $path, $body);
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
        }
    }

    #[Test]
    public function anotherOrganisationsEventAndAnotherEventsShiftAreNotFound(): void
    {
        $shift = $this->shift('Bar', '2027-03-06T16:00', '2027-03-07T01:00');
        $stranger = $this->account('stranger@else.where', 'Stranger');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $this->as($stranger, 'POST', $this->path('jobs'), ['name' => 'Coats', 'access' => 'view']);
        self::assertSame(404, $this->statusCode());

        $this->eventId = $this->newEvent();
        $this->as($this->owner, 'PUT', $this->path('shifts/' . $shift['id']), ['startsAt' => '2027-03-06T16:00', 'endsAt' => '2027-03-06T18:00', 'needed' => 1]);
        self::assertSame(404, $this->statusCode());
    }

    /** @return array{id: string, job: string, startsAt: string, endsAt: string, needed: int, people: list<string>} */
    private function shift(string $job, string $from, string $to, int $needed = 1): array
    {
        $before = Vec\map($this->plan()['shifts'], static fn (array $one): string => $one['id']);
        $this->as($this->owner, 'POST', $this->path('shifts'), ['job' => $this->job($job)['id'], 'startsAt' => $from, 'endsAt' => $to, 'needed' => $needed]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        return Iter\search(self::shifts($this->last()['shifts'] ?? null), static fn (array $one): bool => !Iter\contains($before, $one['id'])) ?? self::fail('no new shift');
    }

    /**
     * @param array{id: string, ...} $shift
     *
     * @return array{id: string, job: string, startsAt: string, endsAt: string, needed: int, people: list<string>}
     */
    private function shiftOf(array $shift): array
    {
        return Iter\search($this->plan()['shifts'], static fn (array $one): bool => $one['id'] === $shift['id']) ?? self::fail('no shift');
    }

    /** @param array{id: string, ...} $shift */
    private function assign(array $shift, string $person): void
    {
        $this->as($this->owner, 'PUT', $this->path('shifts/' . $shift['id'] . '/people/' . $person));
    }

    private function person(string $name, ?string $job = null): string
    {
        $this->as($this->owner, 'POST', $this->staff(), ['fullName' => $name, 'job' => $job]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        return Type\shape(['id' => Type\string()], true)->coerce($this->last()['staff'] ?? null)['id'];
    }

    /** @return array{id: string, name: string, access: string} */
    private function job(string $name): array
    {
        return Iter\search($this->plan()['jobs'], static fn (array $job): bool => $job['name'] === $name) ?? self::fail('no job ' . $name);
    }

    /** @return array{id: string, job: ?array{id: string, name: string}, shifts: mixed, ...} */
    private function staffEntry(string $id): array
    {
        return Iter\search($this->plan()['staff'], static fn (array $one): bool => $one['id'] === $id) ?? self::fail('nobody ' . $id);
    }

    /** @return array{staff: list<array{id: string, fullName: string, job: ?array{id: string, name: string}, shifts: mixed, ...}>, jobs: list<array{id: string, name: string, access: string}>, shifts: list<array{id: string, job: string, startsAt: string, endsAt: string, needed: int, people: list<string>}>} */
    private function plan(): array
    {
        $body = $this->as($this->owner, 'GET', $this->staff());

        return [
            'staff' => Type\vec(Type\shape([
                'id' => Type\string(),
                'fullName' => Type\string(),
                'job' => Type\nullable(Type\shape(['id' => Type\string(), 'name' => Type\string()])),
                'shifts' => Type\mixed(),
            ], true))->coerce($body['staff'] ?? null),
            'jobs' => Type\vec(Type\shape(['id' => Type\string(), 'name' => Type\string(), 'access' => Type\string()]))->coerce($body['jobs'] ?? null),
            'shifts' => self::shifts($body['shifts'] ?? null),
        ];
    }

    /** @return list<array{id: string, job: string, startsAt: string, endsAt: string, needed: int, people: list<string>}> */
    private static function shifts(mixed $raw): array
    {
        return Type\vec(Type\shape([
            'id' => Type\string(),
            'job' => Type\string(),
            'startsAt' => Type\string(),
            'endsAt' => Type\string(),
            'needed' => Type\int(),
            'people' => Type\vec(Type\string()),
        ]))->coerce($raw);
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
        return '/api/events/' . $this->eventId . '/staff/' . $rest;
    }

    private function staff(?string $id = null): string
    {
        return '/api/events/' . $this->eventId . '/staff' . (null === $id ? '' : '/' . $id);
    }

    private function code(): ?string
    {
        $type = $this->last()['type'] ?? null;

        return \is_string($type) ? Str\after_last($type, '/') : null;
    }

    private function violation(string $path): ?string
    {
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []);

        return Iter\search($violations, static fn (array $violation): bool => $violation['propertyPath'] === $path)['message'] ?? null;
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, string $name, EventRole $on): User
    {
        $user = $this->account($address, $name);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => SeededRole::Member]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();
        self::onEvent($user, $this->eventId, $on);

        return $user;
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
