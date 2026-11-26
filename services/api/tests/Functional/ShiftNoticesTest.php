<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Messaging\NotificationWorker;
use App\Domain\Messaging\PushTargets;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\TokenIssuer;
use App\Domain\User\UserRegistrar;
use App\Entity\NotificationPreference;
use App\Entity\Organisation;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use App\Enum\PushTargetKind;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingPushSender;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** A person whose briefing went is told of a change to their shifts, 15 minutes after the last edit, by push to the app they signed in to (sc-4333). */
final class ShiftNoticesTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    private string $jobId;

    private string $ada;

    private string $evening;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-01T10:00:00Z'));
        $this->owner = $this->account('owner@ire.events', 'Ifeoma Nduka');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent();
        $this->jobId = $this->newJob('Bartender');
        $this->ada = $this->person('Ada Obi', '0803 111 0009');
        $this->evening = $this->newShift('2027-03-06T18:00', '2027-03-06T23:00');
        $this->assign($this->evening, $this->ada);
        $this->signedIn($this->ada, 'ada@example.com', withPush: true);
    }

    #[Test]
    public function nothingGoesBeforeTheBriefingWent(): void
    {
        $this->editTimes($this->evening, '2027-03-06T19:00', '2027-03-06T23:00');
        $this->at('2027-03-01T11:00:00Z');

        self::assertSame([], $this->pushes());
        self::assertNull($this->row($this->ada)['notice']);
    }

    #[Test]
    public function aChangeWaitsFifteenMinutesThenGoesByPushWithTheNewTimeAndTheOld(): void
    {
        $this->briefed($this->ada);
        $this->editTimes($this->evening, '2027-03-06T19:00', '2027-03-06T23:00');

        self::assertSame([
            'state' => 'waiting',
            'goesAt' => '2027-03-01T11:15:00+01:00',
            'changes' => [[
                'kind' => 'start_time',
                'start' => '2027-03-06T19:00:00+01:00',
                'end' => null,
                'oldStart' => '2027-03-06T18:00:00+01:00',
                'oldEnd' => null,
                'new' => null,
                'old' => null,
                'count' => 0,
            ]],
        ], $this->row($this->ada)['notice']);

        $this->at('2027-03-01T10:14:00Z');
        self::assertSame([], $this->pushes());

        $this->at('2027-03-01T10:15:00Z');
        self::assertSame([['Your shift has changed · Owambe', ['Your start time is now 19:00 (was 18:00).'], '/app/events/' . $this->eventId . '/my-night']], $this->pushes());
        self::assertSame(['state' => 'told', 'at' => '2027-03-01T11:15:00+01:00', 'channel' => 'push'], $this->row($this->ada)['notice']);
    }

    #[Test]
    public function editsWithinTheFifteenMinutesGoAsOneMessageWithTheFinalState(): void
    {
        $this->briefed($this->ada);
        $this->editTimes($this->evening, '2027-03-06T19:00', '2027-03-06T23:00');
        $this->at('2027-03-01T10:10:00Z');
        $this->editTimes($this->evening, '2027-03-06T19:00', '2027-03-07T01:00');
        $this->at('2027-03-01T10:16:00Z');
        self::assertSame([], $this->pushes());

        $this->at('2027-03-01T10:25:00Z');

        self::assertSame([['Your shift has changed · Owambe', [
            'Your start time is now 19:00 (was 18:00).',
            'Your end time is now Sunday 01:00 (was 23:00).',
        ], '/app/events/' . $this->eventId . '/my-night']], $this->pushes());
    }

    #[Test]
    public function anUnassignPutBackWithinTheFifteenMinutesSendsNothingAndClearsTheLine(): void
    {
        $this->briefed($this->ada);
        $this->as($this->owner, 'DELETE', $this->path('shifts/' . $this->evening . '/people/' . $this->ada));
        self::assertLessThan(300, $this->statusCode(), Json\encode($this->last()));
        self::assertSame('waiting', Type\shape(['state' => Type\string()], true)->coerce($this->row($this->ada)['notice'])['state']);

        $this->assign($this->evening, $this->ada);
        self::assertNull($this->row($this->ada)['notice']);

        $this->at('2027-03-01T11:00:00Z');
        self::assertSame([], $this->pushes());
    }

    #[Test]
    public function anUnassignOfTheLastShiftSaysTheyHaveNoneLeftAndAreStillOnTheStaff(): void
    {
        $this->briefed($this->ada);
        $this->as($this->owner, 'DELETE', $this->path('shifts/' . $this->evening . '/people/' . $this->ada));
        $this->at('2027-03-01T10:15:00Z');

        self::assertSame([['Your shifts have changed · Owambe', [
            'You no longer have the shift from Saturday 18:00 to 23:00.',
            'You have no shift at Owambe for now. You are still on the staff.',
        ], '/app/events/' . $this->eventId . '/my-night']], $this->pushes());
    }

    #[Test]
    public function aSecondShiftIsNamedWithItsWeekday(): void
    {
        $sunday = $this->newShift('2027-03-07T12:00', '2027-03-07T18:00');
        $this->briefed($this->ada);
        $this->assign($sunday, $this->ada);
        $this->at('2027-03-01T10:15:00Z');

        self::assertSame(['You now have a shift from Sunday 12:00 to 18:00.'], $this->pushes()[0][1] ?? null);
    }

    #[Test]
    public function theBriefingMarkedSentAgainTakesBackAChangeWaitingToGo(): void
    {
        $this->briefed($this->ada);
        $this->editTimes($this->evening, '2027-03-06T19:00', '2027-03-06T23:00');
        $this->briefed($this->ada);
        $this->at('2027-03-01T11:00:00Z');

        self::assertSame([], $this->pushes());
    }

    #[Test]
    public function aNewVenueIsToldToEveryoneWhoseBriefingWent(): void
    {
        $bisi = $this->person('Bisi Ola', '0803 111 0010');
        $this->signedIn($bisi, 'bisi@example.com', withPush: false);
        $this->briefed($this->ada);
        $this->editEvent(['venue' => ['name' => 'Eko Hotel', 'address' => null]]);
        $this->at('2027-03-01T10:15:00Z');

        self::assertSame([['Your shift has changed · Owambe', ['The venue is now Eko Hotel (was Harbour Hall).'], '/app/events/' . $this->eventId . '/my-night']], $this->pushes());
    }

    #[Test]
    public function aBriefedPersonWithoutPushIsSentNothingAndKeepsChangedSinceSent(): void
    {
        $bisi = $this->person('Bisi Ola', '0803 111 0010');
        $this->signedIn($bisi, 'bisi@example.com', withPush: false);
        $this->assign($this->evening, $bisi);
        $this->briefed($bisi);
        $this->editTimes($this->evening, '2027-03-06T19:00', '2027-03-06T23:00');

        self::assertSame(['notice' => null, 'briefing' => 'changed'], $this->row($bisi));

        $this->at('2027-03-01T10:15:00Z');

        self::assertSame([], Vec\filter(self::service(RecordingPushSender::class)->sent, static fn (array $sent): bool => 'Bisi Ola' === $sent['recipient']->name));
        self::assertSame(['notice' => null, 'briefing' => 'changed'], $this->row($bisi));
    }

    #[Test]
    public function aBriefedPersonWithEventDayPushSwitchedOffIsSentNothingAndCountsAsNotInTheApp(): void
    {
        $bisi = $this->person('Bisi Ola', '0803 111 0010');
        $this->signedIn($bisi, 'bisi@example.com', withPush: true);
        $account = self::em()->find(StaffMember::class, $bisi)?->getAccount() ?? self::fail('no account');
        self::em()->persist(new NotificationPreference($account, NotificationCategory::EventDay, NotificationChannel::Push, false));
        self::em()->flush();
        $this->assign($this->evening, $bisi);
        $this->briefed($bisi);
        $this->editTimes($this->evening, '2027-03-06T19:00', '2027-03-06T23:00');

        self::assertSame(['notice' => null, 'briefing' => 'changed'], $this->row($bisi));
        self::assertFalse($this->inApp($bisi));
        self::assertTrue($this->inApp($this->ada));

        $this->at('2027-03-01T10:15:00Z');

        self::assertSame([], Vec\filter(self::service(RecordingPushSender::class)->sent, static fn (array $sent): bool => 'Bisi Ola' === $sent['recipient']->name));
        self::assertSame(['notice' => null, 'briefing' => 'changed'], $this->row($bisi));
    }

    #[Test]
    public function aBriefedPersonNeverSignedInIsSentNothing(): void
    {
        $bisi = $this->person('Bisi Ola', '0803 111 0010');
        $this->assign($this->evening, $bisi);
        $this->briefed($bisi);
        $this->editTimes($this->evening, '2027-03-06T19:00', '2027-03-06T23:00');

        self::assertSame(['notice' => null, 'briefing' => 'changed'], $this->row($bisi));
    }

    #[Test]
    public function aRemovalAfterTheBriefingSendsOneLastMessageWithNoLink(): void
    {
        $this->briefed($this->ada);
        $this->editTimes($this->evening, '2027-03-06T19:00', '2027-03-06T23:00');
        $this->as($this->owner, 'DELETE', $this->path($this->ada));
        self::assertLessThan(300, $this->statusCode(), Json\encode($this->last()));
        $this->at('2027-03-01T10:15:00Z');

        self::assertSame([['You are no longer on the staff for Owambe on Saturday 6 Mar', [], null]], $this->pushes());
    }

    #[Test]
    public function aChangeStillWaitingWhenTheEventIsFinishedNeverGoes(): void
    {
        $this->editEvent(['hosts' => ['Ada and Tunde']]);
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->briefed($this->ada);
        $this->at('2027-03-06T23:50:00Z');
        $this->editTimes($this->evening, '2027-03-06T19:00', '2027-03-07T01:00');
        $this->at('2027-03-07T01:30:00Z');

        self::assertSame([], $this->pushes());
    }

    private function briefed(string $staffId): void
    {
        $this->as($this->owner, 'POST', $this->path($staffId . '/briefing/link'));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->as($this->owner, 'POST', $this->path($staffId . '/briefing/sent'));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /** With push, they are signed in to the app with notifications allowed: a live session holding an Expo target. */
    private function signedIn(string $staffId, string $address, bool $withPush): void
    {
        $account = $this->account($address, 'Staff ' . $address);
        $entry = self::em()->find(StaffMember::class, $staffId) ?? self::fail('nobody ' . $staffId);
        $entry->linkAccount(self::em()->find(User::class, $account->getId()));
        self::em()->flush();

        if ($withPush) {
            $session = self::service(TokenIssuer::class)->issueFor($account)->sessionId;
            self::em()->flush();
            self::em()->getConnection()->executeStatement("UPDATE refresh_tokens SET expires_at = '2027-04-01' WHERE chain_id = :chain", ['chain' => $session->toRfc4122()]);
            self::service(PushTargets::class)->register($account->getId(), $session, PushTargetKind::Expo, 'ExponentPushToken[' . $address . ']');
        }
    }

    private function editTimes(string $shiftId, string $from, string $to): void
    {
        $this->as($this->owner, 'PUT', $this->path('shifts/' . $shiftId), ['startsAt' => $from, 'endsAt' => $to, 'needed' => 2]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /** @param array<string, mixed> $fields */
    private function editEvent(array $fields): void
    {
        $this->client->request('GET', '/api/events/' . $this->eventId, server: $this->headers());
        $tag = (string) $this->client->getResponse()->headers->get('ETag');
        $this->client->request('PATCH', '/api/events/' . $this->eventId, server: [...$this->headers(), 'HTTP_IF_MATCH' => $tag, 'CONTENT_TYPE' => 'application/merge-patch+json'], content: Json\encode($fields));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /** The worker runs every step due by now, then each push it sent is read as its title, its lines and where it opens. */
    private function at(string $instant): void
    {
        self::mockTime(new DateTimeImmutable($instant));

        do {
            $stepped = self::service(NotificationWorker::class)->step();
        } while ($stepped);
    }

    /** @return list<array{0: string, 1: list<string>, 2: ?string}> */
    private function pushes(): array
    {
        return Vec\map(self::service(RecordingPushSender::class)->sent, static fn (array $sent): array => [$sent['notification']->subject, $sent['notification']->lines, $sent['notification']->place]);
    }

    /** @return array{notice: mixed, briefing: string} */
    private function row(string $staffId): array
    {
        $staff = Type\vec(Type\shape(['id' => Type\string(), 'notice' => Type\mixed(), 'briefing' => Type\string()], true))->coerce($this->as($this->owner, 'GET', $this->path(''))['staff'] ?? null);
        $row = Iter\search($staff, static fn (array $one): bool => $one['id'] === $staffId) ?? self::fail('nobody ' . $staffId);

        return ['notice' => $row['notice'], 'briefing' => $row['briefing']];
    }

    private function inApp(string $staffId): bool
    {
        $staff = Type\vec(Type\shape(['id' => Type\string(), 'inApp' => Type\bool()], true))->coerce($this->as($this->owner, 'GET', $this->path(''))['staff'] ?? null);

        return (Iter\search($staff, static fn (array $one): bool => $one['id'] === $staffId) ?? self::fail('nobody ' . $staffId))['inApp'];
    }

    private function assign(string $shiftId, string $staffId): void
    {
        $this->as($this->owner, 'PUT', $this->path('shifts/' . $shiftId . '/people/' . $staffId));
        self::assertLessThan(300, $this->statusCode(), Json\encode($this->last()));
    }

    private function person(string $name, string $mobile): string
    {
        $this->as($this->owner, 'POST', $this->path(''), ['fullName' => $name, 'job' => $this->jobId, 'mobile' => ['countryCode' => 'NG', 'number' => $mobile]]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        return Type\shape(['id' => Type\string()], true)->coerce($this->last()['staff'] ?? null)['id'];
    }

    private function newJob(string $name): string
    {
        $this->as($this->owner, 'POST', $this->path('jobs'), ['name' => $name, 'access' => 'check_in']);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $jobs = Type\vec(Type\shape(['id' => Type\string(), 'name' => Type\string()], true))->coerce($this->as($this->owner, 'GET', $this->path(''))['jobs'] ?? null);

        return (Iter\search($jobs, static fn (array $job): bool => $name === $job['name']) ?? self::fail('no job ' . $name))['id'];
    }

    private function newShift(string $from, string $to): string
    {
        $this->as($this->owner, 'POST', $this->path('shifts'), ['job' => $this->jobId, 'startsAt' => $from, 'endsAt' => $to, 'needed' => 2]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $shifts = Type\vec(Type\shape(['id' => Type\string(), 'startsAt' => Type\string()], true))->coerce($this->last()['shifts'] ?? null);

        return (Iter\search($shifts, static fn (array $shift): bool => Str\starts_with($shift['startsAt'], $from)) ?? self::fail('no shift at ' . $from))['id'];
    }

    private function newEvent(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2027-03-06T16:00',
            'endsAt' => '2027-03-07T02:00',
            'venue' => ['name' => 'Harbour Hall', 'address' => null],
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

    /** @return array<string, string> */
    private function headers(): array
    {
        $who = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no user');

        return ['HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who), 'HTTP_ACCEPT_LANGUAGE' => 'en'];
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
