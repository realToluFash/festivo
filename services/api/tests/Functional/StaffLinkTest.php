<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\StaffLinkToken;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\RefusingRateLimiterFactory;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** Each person's own link (sc-3912): given from the roster, opened by its token alone, and nothing about the night before sign-in (sc-4235). */
final class StaffLinkTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    private string $jobId;

    private string $ada;

    /** @var array{id: string, job: string} */
    private array $shift;

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
        $this->shift = $this->newShift('2027-03-06T18:00', '2027-03-06T23:00');
        $this->as($this->owner, 'PUT', $this->path('shifts/' . $this->shift['id'] . '/people/' . $this->ada));
        self::assertLessThan(300, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function copyLinkGivesALinkToTheWebAndRecordsCopiedByWhom(): void
    {
        $url = $this->deliver($this->ada);
        $row = $this->row($this->ada);

        self::assertMatchesRegularExpression('#^https?://[^/]+/w/[A-Za-z0-9_-]{22}$#', $url);
        self::assertSame(['link' => 'copied', 'linkBy' => 'Ifeoma Nduka', 'linkAt' => '2027-03-01T11:00:00+01:00'], $row);
    }

    #[Test]
    public function shareRecordsShared(): void
    {
        $this->deliver($this->ada, 'share');

        self::assertSame('shared', $this->row($this->ada)['link']);
    }

    #[Test]
    public function theTokenIsKeptOnlyAsItsHashAndNeverInTheAuditLog(): void
    {
        $token = self::token($this->deliver($this->ada));
        self::em()->clear();
        $stored = self::em()->getRepository(StaffLinkToken::class)->findAll();
        $audit = Json\encode(self::em()->getConnection()->fetchAllAssociative('SELECT * FROM audit_entries'));

        self::assertSame([\hash('sha256', $token)], Vec\map($stored, static fn (StaffLinkToken $one): string => $one->getTokenHash()));
        self::assertTrue(Str\contains($audit, 'staff.link_issued'));
        self::assertFalse(Str\contains($audit, $token));
    }

    #[Test]
    public function markAsSentFollowsACopyAndNothingElse(): void
    {
        $this->as($this->owner, 'POST', $this->linkPath($this->ada) . '/sent');
        self::assertSame('none', $this->row($this->ada)['link']);

        $this->deliver($this->ada);
        $this->as($this->owner, 'POST', $this->linkPath($this->ada) . '/sent');

        self::assertSame(['link' => 'sent', 'linkBy' => 'Ifeoma Nduka', 'linkAt' => '2027-03-01T11:00:00+01:00'], $this->row($this->ada));
    }

    #[Test]
    public function aCopyOrShareOnALinkSentRowLeavesItsWordAndItsLine(): void
    {
        $this->deliver($this->ada);
        $this->as($this->owner, 'POST', $this->linkPath($this->ada) . '/sent');
        $before = $this->row($this->ada);
        $this->at('2027-03-01T12:00:00Z');

        $this->deliver($this->ada);
        $this->deliver($this->ada, 'share');

        self::assertSame($before, $this->row($this->ada));
    }

    #[Test]
    public function aCopyOnALinkOpenedRowLeavesItAndTheNewLinkOpensTheSameRow(): void
    {
        $first = self::token($this->deliver($this->ada));
        $this->at('2027-03-06T17:00:00Z');
        $this->open('opened', $first);
        $before = $this->row($this->ada);
        self::assertSame('opened', $before['link']);

        $second = self::token($this->deliver($this->ada));
        self::assertSame($before, $this->row($this->ada));
        self::assertSame(['state' => 'open'], $this->open('opened', $second));
        self::assertSame($before, $this->row($this->ada));
    }

    #[Test]
    public function aSecondCopyLeavesTheFirstLinkWorking(): void
    {
        $first = self::token($this->deliver($this->ada));
        $second = self::token($this->deliver($this->ada));
        $this->at('2027-03-06T17:00:00Z');

        self::assertNotSame($first, $second);
        self::assertSame(['state' => 'open'], $this->open('look', $first));
        self::assertSame(['state' => 'open'], $this->open('look', $second));
    }

    #[Test]
    public function aPersonWithoutAMobileNumberIsGivenNoLink(): void
    {
        $kemi = $this->person('Kemi Ade', null);

        $this->as($this->owner, 'POST', $this->linkPath($kemi), ['via' => 'copy']);

        self::assertSame(409, $this->statusCode());
        self::assertSame([], self::em()->getRepository(StaffLinkToken::class)->findAll());
    }

    #[Test]
    public function onlySomeoneWhoManagesTheStaffGivesMarksOrReplacesALink(): void
    {
        $viewer = $this->member('viewer@ire.events', 'Bisi Ola', EventRole::CanView);

        foreach (['', '/sent', '/replace'] as $what) {
            $this->as($viewer, 'POST', $this->linkPath($this->ada) . $what, ['via' => 'copy']);
            self::assertSame(403, $this->statusCode(), $what);
        }

        self::assertSame([], self::em()->getRepository(StaffLinkToken::class)->findAll());
    }

    #[Test]
    public function theWindowOpens12HoursBeforeTheFirstShiftAndEnds2HoursAfterTheLast(): void
    {
        $token = self::token($this->deliver($this->ada));

        $this->at('2027-03-06T04:59:59Z');
        self::assertSame(['state' => 'not_yet', 'from' => '2027-03-06T06:00:00+01:00'], $this->open('look', $token));
        $this->at('2027-03-06T05:00:00Z');
        self::assertSame(['state' => 'open'], $this->open('look', $token));
        $this->at('2027-03-06T23:59:59Z');
        self::assertSame(['state' => 'open'], $this->open('look', $token));
        $this->at('2027-03-07T00:00:00Z');
        self::assertSame(['state' => 'ended'], $this->open('look', $token));
    }

    #[Test]
    public function aShiftChangedOnTheNightMovesTheWindowAtOnce(): void
    {
        $token = self::token($this->deliver($this->ada));
        $this->at('2027-03-07T00:30:00Z');
        self::assertSame(['state' => 'ended'], $this->open('look', $token));

        $this->as($this->owner, 'PUT', $this->path('shifts/' . $this->shift['id']), ['job' => $this->jobId, 'startsAt' => '2027-03-06T18:00', 'endsAt' => '2027-03-07T01:00', 'needed' => 1]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame(['state' => 'open'], $this->open('look', $token));
    }

    #[Test]
    public function lookingRecordsNothingAndAGetIsNotAnswered(): void
    {
        $token = self::token($this->deliver($this->ada));
        $this->at('2027-03-06T17:00:00Z');

        $this->open('look', $token);
        $this->client->request('GET', '/api/staff-links/look?token=' . $token);

        self::assertSame(405, $this->statusCode());
        self::assertSame('copied', $this->row($this->ada)['link']);
    }

    #[Test]
    public function theVisiblePageRecordsOpenedInsideTheWindowOnly(): void
    {
        $token = self::token($this->deliver($this->ada));

        $this->at('2027-03-06T04:00:00Z');
        $this->open('opened', $token);
        self::assertSame('copied', $this->row($this->ada)['link']);

        $this->at('2027-03-06T17:00:00Z');
        $this->open('opened', $token);
        self::assertSame(['link' => 'opened', 'linkBy' => null, 'linkAt' => '2027-03-06T18:00:00+01:00'], $this->row($this->ada));
    }

    #[Test]
    public function outsideTheWindowTheAnswerCarriesNothingAboutThePersonOrTheEvent(): void
    {
        $token = self::token($this->deliver($this->ada));

        foreach (['2027-03-06T04:00:00Z', '2027-03-07T03:00:00Z'] as $instant) {
            $this->at($instant);
            $this->open('look', $token);
            $raw = (string) $this->client->getResponse()->getContent();

            foreach (['Ada', 'Obi', '0803', '2348031110009', 'Bartender', 'Owambe', 'Ìrè', $this->eventId, $this->ada] as $told) {
                self::assertFalse(Str\contains($raw, $told), $told . ' in ' . $raw);
            }
        }
    }

    #[Test]
    public function insideTheWindowNothingAboutTheShiftGuestsOrStaffReachesACallerBeforeSignIn(): void
    {
        $token = self::token($this->deliver($this->ada));
        $this->at('2027-03-06T17:00:00Z');

        foreach (['look', 'opened'] as $what) {
            self::assertSame(['state' => 'open'], $this->open($what, $token));
            self::assertSame('{"state":"open"}', (string) $this->client->getResponse()->getContent());
        }
    }

    #[Test]
    public function replaceLinkEndsEveryLinkTheyWereGivenAndTheRowReadsNoLinkYet(): void
    {
        $first = self::token($this->deliver($this->ada));
        $second = self::token($this->deliver($this->ada));

        $this->as($this->owner, 'POST', $this->linkPath($this->ada) . '/replace');
        self::assertSame(200, $this->statusCode());

        self::assertSame(['link' => 'none', 'linkBy' => null, 'linkAt' => null], $this->row($this->ada));
        $this->at('2027-03-06T17:00:00Z');
        self::assertSame($this->unknown(), $this->gone('look', $first));
        self::assertSame($this->unknown(), $this->gone('opened', $second));
        self::assertSame(['state' => 'open'], $this->open('look', self::token($this->deliver($this->ada))));
    }

    #[Test]
    public function removingThePersonEndsEveryLinkTheyWereGiven(): void
    {
        $first = self::token($this->deliver($this->ada));
        $second = self::token($this->deliver($this->ada));

        $this->as($this->owner, 'DELETE', $this->path($this->ada));
        self::assertLessThan(300, $this->statusCode(), Json\encode($this->last()));

        self::assertSame($this->unknown(), $this->gone('look', $first));
        self::assertSame($this->unknown(), $this->gone('opened', $second));
    }

    #[Test]
    public function theLinkIsRateLimited(): void
    {
        self::getContainer()->set('limiter.staff_link', new RefusingRateLimiterFactory(new DateTimeImmutable('2027-03-01T10:10:00Z')));

        $this->gone('look', 'AAAAAAAAAAAAAAAAAAAAAA');

        self::assertSame(429, $this->statusCode());
    }

    #[Test]
    public function theAccessListShowsEachPersonWithALiveLinkOnceAndNotSignedIn(): void
    {
        $this->deliver($this->ada);
        $this->deliver($this->ada, 'share');
        $this->person('Kemi Ade', '0803 111 0010');

        self::assertSame([[
            'id' => $this->ada,
            'name' => 'Ada Obi',
            'job' => 'Bartender',
            'access' => 'check_in',
            'endsAt' => '2027-03-07T01:00:00+01:00',
            'signedIn' => false,
        ]], $this->people()['staffLinks']);

        $this->as($this->owner, 'POST', $this->linkPath($this->ada) . '/replace');
        self::assertSame([], $this->people()['staffLinks']);
    }

    #[Test]
    public function theAccessListLeavesOutALinkWhoseWindowHasEnded(): void
    {
        $this->deliver($this->ada);
        $this->at('2027-03-07T00:00:00Z');

        self::assertSame([], $this->people()['staffLinks']);
    }

    /** @return array<string, mixed> */
    private function open(string $what, #[SensitiveParameter] string $token): array
    {
        $this->gone($what, $token);
        self::assertSame(200, $this->statusCode(), (string) $this->client->getResponse()->getContent());

        return $this->last();
    }

    /** @return array{int, string} the status and the body, less the correlation id every answer has its own of */
    private function gone(string $what, #[SensitiveParameter] string $token): array
    {
        $this->client->request('POST', '/api/staff-links/' . $what, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode(['token' => $token]));

        return [$this->statusCode(), Regex\replace((string) $this->client->getResponse()->getContent(), '/,"correlationId":"[0-9a-f-]{36}"/', '')];
    }

    /** @return array{int, string} */
    private function unknown(): array
    {
        $answer = $this->gone('look', 'AAAAAAAAAAAAAAAAAAAAAA');
        self::assertSame(404, $answer[0]);

        return $answer;
    }

    private function at(string $instant): void
    {
        self::mockTime(new DateTimeImmutable($instant));
    }

    private function deliver(string $staffId, string $via = 'copy'): string
    {
        $answer = $this->as($this->owner, 'POST', $this->linkPath($staffId), ['via' => $via]);
        self::assertSame(200, $this->statusCode(), Json\encode($answer));

        return Type\string()->coerce($answer['url'] ?? null);
    }

    private static function token(string $url): string
    {
        return Str\after_last($url, '/') ?? self::fail('no token in ' . $url);
    }

    /** @return array{link: string, linkBy: ?string, linkAt: ?string} */
    private function row(string $staffId): array
    {
        $staff = Type\vec(Type\shape([
            'id' => Type\string(),
            'link' => Type\string(),
            'linkBy' => Type\nullable(Type\string()),
            'linkAt' => Type\nullable(Type\string()),
        ], true))->coerce($this->as($this->owner, 'GET', $this->path(''))['staff'] ?? null);

        $row = Iter\search($staff, static fn (array $one): bool => $one['id'] === $staffId) ?? self::fail('nobody ' . $staffId);

        return ['link' => $row['link'], 'linkBy' => $row['linkBy'], 'linkAt' => $row['linkAt']];
    }

    /** @return array{staffLinks: list<mixed>, ...} */
    private function people(): array
    {
        $body = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/people');
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\shape(['staffLinks' => Type\vec(Type\mixed())], true)->coerce($body);
    }

    private function person(string $name, ?string $mobile): string
    {
        $body = ['fullName' => $name, 'job' => $this->jobId];

        if (null !== $mobile) {
            $body['mobile'] = ['countryCode' => 'NG', 'number' => $mobile];
        }

        $this->as($this->owner, 'POST', $this->path(''), $body);
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

    /** @return array{id: string, job: string} */
    private function newShift(string $from, string $to): array
    {
        $this->as($this->owner, 'POST', $this->path('shifts'), ['job' => $this->jobId, 'startsAt' => $from, 'endsAt' => $to, 'needed' => 1]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $shift = Type\shape(['id' => Type\string(), 'job' => Type\string()], true)->coerce(Type\vec(Type\mixed())->coerce($this->last()['shifts'] ?? null)[0] ?? null);

        return ['id' => $shift['id'], 'job' => $shift['job']];
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

    private function linkPath(string $staffId): string
    {
        return $this->path($staffId . '/link');
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
