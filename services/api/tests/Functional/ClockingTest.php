<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Organisation;
use App\Entity\PhoneNumber;
use App\Entity\ShiftAttendance;
use App\Entity\StaffMember;
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

/** Clocking in and out (sc-234): Grace's shift is 17:00 to 01:00 in Lagos (16:00Z to 00:00Z), so her link runs until 03:00 (02:00Z). */
final class ClockingTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use ReadsSentPhoneCodes;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string NUMBER = '+2348031110009';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    private string $jobId;

    private string $grace;

    private ?string $token = null;

    private bool $onAShift = false;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-06T14:30:00Z'));
        $this->owner = $this->account('owner@ire.events', 'Ifeoma Nduka');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent();
        $this->jobId = $this->newJob('Waiter');
        $this->grace = $this->person('Grace Okon', '0803 111 0009');
    }

    #[Test]
    public function clockingInOpensAnHourBeforeTheStartAndClosesAtTheScheduledEnd(): void
    {
        $user = $this->signedIn();
        self::mockTime(new DateTimeImmutable('2027-03-06T14:59:00Z'));
        self::assertSame('before', $this->card($user)['phase']);
        $this->clock($user, 'in');
        self::assertSame(409, $this->statusCode(), 'a minute before the window');

        self::mockTime(new DateTimeImmutable('2027-03-07T00:00:00Z'));
        self::assertSame('closed', $this->card($user)['phase']);
        $this->clock($user, 'in');
        self::assertSame(409, $this->statusCode(), 'at the scheduled end');

        self::mockTime(new DateTimeImmutable('2027-03-06T15:00:00Z'));
        $clocked = $this->clock($user, 'in');
        self::assertSame(200, $this->statusCode(), Json\encode($clocked));
        self::assertSame('recorded', $clocked['outcome']);
        self::assertSame(['phase' => 'on', 'opensAt' => '2027-03-06T16:00:00+01:00', 'closesAt' => '2027-03-07T01:00:00+01:00', 'clockedInAt' => '2027-03-06T16:00:00+01:00', 'clockedOutAt' => null, 'outUntil' => '2027-03-07T07:00:00+01:00', 'workedMinutes' => null], $clocked['clock']);
    }

    #[Test]
    public function aSecondClockInChangesNothingAndTheTimeIsTheServersWhenItArrives(): void
    {
        $user = $this->signedIn();
        self::mockTime(new DateTimeImmutable('2027-03-06T15:58:00Z'));
        $this->clock($user, 'in');
        self::mockTime(new DateTimeImmutable('2027-03-06T16:20:00Z'));
        $again = $this->clock($user, 'in');

        self::assertSame(200, $this->statusCode());
        self::assertSame('already', $again['outcome']);
        self::assertSame('2027-03-06T16:58:00+01:00', Type\shape(['clockedInAt' => Type\string()], true)->coerce($again['clock'])['clockedInAt']);
    }

    #[Test]
    public function clockingOutWithoutClockingInIsRefusedAndASecondClockOutChangesNothing(): void
    {
        $user = $this->signedIn();
        self::mockTime(new DateTimeImmutable('2027-03-06T16:30:00Z'));
        $this->clock($user, 'out');
        self::assertSame(409, $this->statusCode());

        $this->clock($user, 'in');
        self::mockTime(new DateTimeImmutable('2027-03-07T00:42:00Z'));
        self::assertSame('recorded', $this->clock($user, 'out')['outcome']);
        self::mockTime(new DateTimeImmutable('2027-03-07T00:50:00Z'));
        $again = $this->clock($user, 'out');
        self::assertSame('already', $again['outcome']);
        $card = Type\shape(['phase' => Type\string(), 'clockedOutAt' => Type\string(), 'workedMinutes' => Type\int()], true)->coerce($again['clock']);
        self::assertSame(['off', '2027-03-07T01:42:00+01:00', 492], [$card['phase'], $card['clockedOutAt'], $card['workedMinutes']]);
    }

    #[Test]
    public function pastTheirAccessAPersonStillClockedInReachesTheClockCardAloneAndClocksOut(): void
    {
        $user = $this->signedIn();
        self::mockTime(new DateTimeImmutable('2027-03-06T15:58:00Z'));
        $this->clock($user, 'in');
        self::mockTime(new DateTimeImmutable('2027-03-07T03:05:00Z'));

        $night = $this->as($user, 'POST', '/api/staff-links/night', ['token' => $this->link($this->grace, fresh: false)]);
        self::assertSame(200, $this->statusCode(), Json\encode($night));
        self::assertTrue($night['pastAccess']);
        self::assertSame(['Owambe', '2027-03-07T07:00:00+01:00'], [Type\shape(['name' => Type\string()], true)->coerce($night['event'])['name'], $night['endsAt']]);
        self::assertSame([null, null, null, null, null, [], null], [$night['station'], $night['job'], $night['shift'], $night['later'], $night['lead'], $night['timing'], $night['tables']]);
        self::assertTrue($this->as($user, 'GET', '/api/events/' . $this->eventId . '/my-night')['pastAccess'] ?? null, 'in the app too');

        $this->as($user, 'GET', '/api/events/' . $this->eventId . '/staff');
        self::assertContains($this->statusCode(), [403, 404], 'nothing but the clock card');
        $look = $this->as($user, 'POST', '/api/staff-links/look', ['token' => $this->link($this->grace, fresh: false)]);
        self::assertSame(['open', true, null], [$look['state'], $look['pastAccess'], $look['job']]);

        self::mockTime(new DateTimeImmutable('2027-03-07T03:12:00Z'));
        $out = $this->clock($user, 'out');
        self::assertSame(200, $this->statusCode(), Json\encode($out));
        self::assertSame('2027-03-07T04:12:00+01:00', Type\shape(['clockedOutAt' => Type\string()], true)->coerce($out['clock'])['clockedOutAt']);

        $this->as($user, 'POST', '/api/staff-links/night', ['token' => $this->link($this->grace, fresh: false)]);
        self::assertSame(404, $this->statusCode(), 'once clocked out, the link has ended');
    }

    #[Test]
    public function aClockOutAfterTheEventFinishedEarlyIsStillTaken(): void
    {
        $user = $this->signedIn();
        self::mockTime(new DateTimeImmutable('2027-03-06T15:58:00Z'));
        $this->clock($user, 'in');
        $this->event()->end(new DateTimeImmutable('2027-03-06T22:00:00Z'));
        self::em()->flush();
        self::mockTime(new DateTimeImmutable('2027-03-06T23:30:00Z'));

        self::assertTrue($this->as($user, 'POST', '/api/staff-links/night', ['token' => $this->link($this->grace, fresh: false)])['pastAccess'] ?? null);
        self::assertSame('recorded', $this->clock($user, 'out')['outcome'] ?? null);
    }

    #[Test]
    public function theClockCardIsGoneSixHoursAfterTheScheduledEnd(): void
    {
        $user = $this->signedIn();
        self::mockTime(new DateTimeImmutable('2027-03-06T15:58:00Z'));
        $this->clock($user, 'in');
        self::mockTime(new DateTimeImmutable('2027-03-07T06:00:00Z'));

        $this->as($user, 'POST', '/api/staff-links/night', ['token' => $this->link($this->grace, fresh: false)]);
        self::assertSame(404, $this->statusCode());
        $this->clock($user, 'out');
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function onALongShiftTheClockCardIsGone24HoursAfterTheClockIn(): void
    {
        $this->onShift($this->grace, '2027-03-06T08:00', '2027-03-07T07:00');
        $user = $this->signedIn();
        self::mockTime(new DateTimeImmutable('2027-03-06T06:30:00Z'));
        $clocked = $this->clock($user, 'in');
        self::assertSame('2027-03-07T07:30:00+01:00', Type\shape(['outUntil' => Type\string()], true)->coerce($clocked['clock'])['outUntil']);

        self::mockTime(new DateTimeImmutable('2027-03-07T06:31:00Z'));
        self::assertNull($this->as($user, 'POST', '/api/staff-links/night', ['token' => $this->link($this->grace, fresh: false)])['clock'] ?? null);
        $this->clock($user, 'out');
        self::assertSame(409, $this->statusCode(), 'still inside the link, past the clock-out');
    }

    #[Test]
    public function hoursWorkedShowARealLateClockOutAMissingClockOutAndAMissingClockInWithTheirMarks(): void
    {
        $user = $this->signedIn();
        $kunle = $this->person('Kunle Bello', '0803 111 0011');
        $emeka = $this->person('Emeka Obi', '0803 111 0012');
        $this->onShift($kunle, '2027-03-06T17:00', '2027-03-07T01:00');
        $this->onShift($emeka, '2027-03-06T17:00', '2027-03-07T01:00');
        self::mockTime(new DateTimeImmutable('2027-03-06T15:52:00Z'));
        $this->clock($user, 'in');
        $this->attend($kunle, '2027-03-06T16:04:00Z', null);
        self::mockTime(new DateTimeImmutable('2027-03-07T02:12:00Z'));
        $this->clock($user, 'out');
        self::mockTime(new DateTimeImmutable('2027-03-07T09:00:00Z'));

        $hours = $this->as($this->owner, 'GET', $this->path('hours'));
        self::assertSame(200, $this->statusCode(), Json\encode($hours));
        $rows = $this->rows($hours);
        self::assertSame([620, 0, null], [$rows['Grace Okon']['workedMinutes'], $rows['Grace Okon']['assumedMinutes'], $rows['Grace Okon']['mark']]);
        self::assertSame([476, 476, 'not_clocked_out'], [$rows['Kunle Bello']['workedMinutes'], $rows['Kunle Bello']['assumedMinutes'], $rows['Kunle Bello']['mark']]);
        self::assertSame([0, 'no_attendance'], [$rows['Emeka Obi']['workedMinutes'], $rows['Emeka Obi']['mark']]);
        self::assertSame(['workedMinutes' => 1096, 'scheduledMinutes' => 1440, 'assumedMinutes' => 476, 'noAttendance' => 1, 'clockedIn' => 2, 'total' => 3], $hours['summary']);
        self::assertFalse($hours['live']);
        self::assertTrue($hours['canCorrect']);
    }

    #[Test]
    public function aMissingClockInEnteredAsACorrectionClearsItsMarkAndIsKeptBesideNoRecord(): void
    {
        $emeka = $this->person('Emeka Obi', '0803 111 0012');
        $this->onShift($emeka, '2027-03-06T17:00', '2027-03-07T01:00');
        self::mockTime(new DateTimeImmutable('2027-03-07T01:10:00Z'));
        $shift = $this->shiftOf($emeka);

        $hours = $this->as($this->owner, 'PUT', $this->path('hours/' . $shift . '/' . $emeka), ['clockedInAt' => '2027-03-06T17:05', 'clockedOutAt' => '2027-03-07T01:15']);
        self::assertSame(200, $this->statusCode(), Json\encode($hours));
        $row = $this->rows($hours)['Emeka Obi'];
        self::assertNull($row['mark']);
        self::assertSame([490, null, null], [$row['workedMinutes'], $row['recordedInAt'], $row['recordedOutAt']]);
        self::assertSame([
            ['field' => 'in', 'was' => null, 'by' => 'Ifeoma Nduka', 'at' => '2027-03-07T02:10:00+01:00'],
            ['field' => 'out', 'was' => null, 'by' => 'Ifeoma Nduka', 'at' => '2027-03-07T02:10:00+01:00'],
        ], $row['corrections']);
    }

    #[Test]
    public function aCorrectionKeepsTheOriginalAndTheServerRefusesWhatTheFormRefuses(): void
    {
        $this->onShift($this->grace, '2027-03-06T17:00', '2027-03-07T01:00');
        $this->attend($this->grace, '2027-03-06T14:52:00Z', null);
        self::mockTime(new DateTimeImmutable('2027-03-07T08:00:00Z'));
        $path = $this->path('hours/' . $this->shiftOf($this->grace) . '/' . $this->grace);

        foreach ([
            [['clockedInAt' => '', 'clockedOutAt' => '2027-03-07T01:15'], 'clockedInAt', 'Enter the time they started.'],
            [['clockedInAt' => '2027-03-06T15:52', 'clockedOutAt' => null], 'clockedOutAt', 'Enter the time they finished.'],
            [['clockedInAt' => '2027-03-06T15:52', 'clockedOutAt' => '2027-03-06T01:15'], 'clockedOutAt', 'The end must be after the start.'],
            [['clockedInAt' => '2027-03-06T15:52', 'clockedOutAt' => '2027-03-08T01:15'], 'clockedOutAt', "A shift can't be longer than 24 hours. Check the dates."],
        ] as [$body, $field, $message]) {
            $refused = $this->as($this->owner, 'PUT', $path, $body);
            self::assertSame(422, $this->statusCode(), Json\encode($refused));
            self::assertStringContainsString($message, Json\encode($refused), $field);
        }

        $row = $this->rows($this->as($this->owner, 'PUT', $path, ['clockedInAt' => '2027-03-06T15:52', 'clockedOutAt' => '2027-03-07T01:15']))['Grace Okon'];
        self::assertSame(['2027-03-06T15:52:00+01:00', '2027-03-07T01:15:00+01:00', '2027-03-06T15:52:00+01:00', null], [$row['clockedInAt'], $row['clockedOutAt'], $row['recordedInAt'], $row['recordedOutAt']]);
        self::assertSame([['field' => 'out', 'was' => null, 'by' => 'Ifeoma Nduka', 'at' => '2027-03-07T09:00:00+01:00']], $row['corrections']);

        $same = $this->rows($this->as($this->owner, 'PUT', $path, ['clockedInAt' => '2027-03-06T15:52', 'clockedOutAt' => '2027-03-07T01:15']))['Grace Okon'];
        self::assertSame($row, $same, 'a save that changes nothing writes nothing');
    }

    #[Test]
    public function thePersonThemselvesCannotCorrectTheirOwnTimes(): void
    {
        $this->onShift($this->grace, '2027-03-06T17:00', '2027-03-07T01:00');
        $entry = $this->entry($this->grace);
        $entry->linkAccount(self::em()->find(User::class, $this->owner->getId()));
        self::em()->flush();
        self::mockTime(new DateTimeImmutable('2027-03-07T08:00:00Z'));

        $this->as($this->owner, 'PUT', $this->path('hours/' . $this->shiftOf($this->grace) . '/' . $this->grace), ['clockedInAt' => '2027-03-06T15:52', 'clockedOutAt' => '2027-03-07T01:15']);
        self::assertSame(403, $this->statusCode());
    }

    #[Test]
    public function aGrantHolderAtTheirLinkCannotCorrectTimes(): void
    {
        $user = $this->signedIn();
        self::mockTime(new DateTimeImmutable('2027-03-06T20:00:00Z'));

        $this->as($user, 'PUT', $this->path('hours/' . $this->shiftOf($this->grace) . '/' . $this->grace), ['clockedInAt' => '2027-03-06T15:52', 'clockedOutAt' => '2027-03-07T01:15']);
        self::assertContains($this->statusCode(), [403, 404]);
    }

    #[Test]
    public function afterTheEventStaffRatesShowsTheWorkedCostBesideTheScheduledHeadline(): void
    {
        $user = $this->signedIn();
        $this->as($this->owner, 'PUT', '/api/events/' . $this->eventId . '/budget/staff-rates/jobs/' . $this->jobId, ['kind' => 'hourly', 'amount' => '1500', 'currency' => 'NGN']);
        self::assertLessThan(300, $this->statusCode(), Json\encode($this->last()));
        self::mockTime(new DateTimeImmutable('2027-03-06T16:00:00Z'));
        $this->clock($user, 'in');
        self::mockTime(new DateTimeImmutable('2027-03-06T22:00:00Z'));
        $this->clock($user, 'out');
        $before = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/budget/staff-rates');
        self::assertNull($before['worked'], 'not before the event has ended');

        self::mockTime(new DateTimeImmutable('2027-03-07T03:00:00Z'));
        $rates = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/budget/staff-rates');
        self::assertSame(200, $this->statusCode(), Json\encode($rates));
        self::assertSame(['total' => '9000.00', 'minutes' => 360, 'scheduledMinutes' => 1440, 'assumedMinutes' => 0, 'noAttendance' => 0], $rates['worked']);
        self::assertSame('36000.00', Type\shape(['total' => Type\string()], true)->coerce($rates['headline'])['total'], 'the headline stays the scheduled cost');
    }

    #[Test]
    public function aJoinCodeNamingAShiftPutsItsRedeemerOnItAndClocksThemInWhileTheWindowIsOpen(): void
    {
        $this->onShift($this->grace, '2027-03-06T17:00', '2027-03-07T01:00');
        $shiftId = $this->shiftOf($this->grace);
        $made = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/door-codes', ['role' => 'can_view', 'useCap' => 5, 'expiresAt' => '2027-03-07T00:00:00+00:00', 'shiftId' => $shiftId]);
        self::assertSame(201, $this->statusCode(), Json\encode($made));
        $code = Type\shape(['code' => Type\string(), 'shiftId' => Type\string()], true)->coerce($made['doorCode'] ?? null);
        self::assertSame($shiftId, $code['shiftId']);

        self::mockTime(new DateTimeImmutable('2027-03-06T15:10:00Z'));
        $tunde = $this->account('tunde@example.com', 'Tunde Bakare');
        $this->as($tunde, 'POST', '/api/door-codes/' . $code['code'] . '/redeem', []);
        self::assertLessThan(300, $this->statusCode(), Json\encode($this->last()));

        $rows = $this->rows($this->as($this->owner, 'GET', $this->path('hours')));
        self::assertSame('Waiter', $rows['Tunde Bakare']['job'] ?? null, Json\encode($rows));
        self::assertSame('2027-03-06T16:10:00+01:00', $rows['Tunde Bakare']['clockedInAt'] ?? null, 'clocked in at the moment they redeemed');

        $early = $this->account('ada@example.com', 'Ada Obi');
        self::mockTime(new DateTimeImmutable('2027-03-06T14:00:00Z'));
        $this->as($early, 'POST', '/api/door-codes/' . $code['code'] . '/redeem', []);
        self::assertLessThan(300, $this->statusCode(), Json\encode($this->last()));
        $rows = $this->rows($this->as($this->owner, 'GET', $this->path('hours')));
        self::assertArrayHasKey('Ada Obi', $rows, 'put on the shift');
        self::assertNull($rows['Ada Obi']['clockedInAt'], 'but not clocked in before the window opens');
    }

    #[Test]
    public function aJoinCodeCannotNameAShiftOnAnotherEvent(): void
    {
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/door-codes', ['role' => 'can_view', 'useCap' => 5, 'expiresAt' => '2027-03-07T00:00:00+00:00', 'shiftId' => '0190a0a0-0000-7000-8000-000000000000']);
        self::assertSame(404, $this->statusCode());
    }

    /** @return array<string, mixed> */
    private function card(User $user): array
    {
        $night = $this->as($user, 'POST', '/api/staff-links/night', ['token' => $this->link($this->grace, fresh: false)]);

        return Type\dict(Type\string(), Type\mixed())->coerce($night['clock'] ?? null);
    }

    /** @return array<string, mixed> */
    private function clock(User $user, string $action): array
    {
        return $this->as($user, 'POST', '/api/staff-links/clock', ['token' => $this->link($this->grace, fresh: false), 'action' => $action]);
    }

    private function attend(string $staffId, string $in, ?string $out): void
    {
        $entry = $this->entry($staffId);
        $shift = Iter\first(Vec\filter(self::em()->getRepository(\App\Entity\StaffShift::class)->findAll(), static fn ($one): bool => Iter\contains($one->getPeople(), $entry))) ?? self::fail('no shift');
        $attendance = new ShiftAttendance($shift, $entry);
        $attendance->clockIn(new DateTimeImmutable($in));

        if (null !== $out) {
            $attendance->clockOut(new DateTimeImmutable($out));
        }

        self::em()->persist($attendance);
        self::em()->flush();
    }

    private function shiftOf(string $staffId): string
    {
        $shifts = Type\vec(Type\shape(['id' => Type\string(), 'people' => Type\vec(Type\string())], true))->coerce($this->as($this->owner, 'GET', $this->path(''))['shifts'] ?? null);

        return (Iter\search($shifts, static fn (array $one): bool => Iter\contains($one['people'], $staffId)) ?? self::fail('no shift'))['id'];
    }

    /**
     * @param array<string, mixed> $hours
     *
     * @return array<string, array<string, mixed>>
     */
    private function rows(array $hours): array
    {
        $rows = [];

        foreach (Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($hours['rows'] ?? null) as $row) {
            $rows[Type\string()->coerce($row['name'])] = $row;
        }

        return $rows;
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
        $this->as($this->owner, 'POST', $this->path('shifts'), ['job' => $this->jobId, 'startsAt' => $startsAt, 'endsAt' => $endsAt, 'needed' => 3]);
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
