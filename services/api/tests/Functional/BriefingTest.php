<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\StaffLinkToken;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The briefing (sc-3917): house rules, Preview as, and the briefing handed out by a copy and Mark as sent. Sending it waits for epic 36. */
final class BriefingTest extends ApiTestCase
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

    private string $shiftId;

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
        $this->shiftId = $this->newShift('2027-03-06T18:00', '2027-03-06T23:00');
        $this->assign($this->shiftId, $this->ada);
    }

    #[Test]
    public function everyoneStartsNotSentWithNoBriefingCopy(): void
    {
        self::assertSame(['briefing' => 'none', 'briefingCopy' => null, 'link' => 'none'], $this->row($this->ada));
    }

    #[Test]
    public function aCopyLeavesTheBriefingAsItWasAndTurnsTheLinkColumnToCopied(): void
    {
        $url = $this->copy($this->ada);

        self::assertMatchesRegularExpression('#^https?://[^/]+/w/[A-Za-z0-9_-]{22}$#', $url);
        self::assertSame([
            'briefing' => 'none',
            'briefingCopy' => ['by' => 'Ifeoma Nduka', 'at' => '2027-03-01T11:00:00+01:00', 'marked' => false],
            'link' => 'copied',
        ], $this->row($this->ada));
    }

    #[Test]
    public function markAsSentAfterABriefingCopyReadsSentNotReadAndLinkSent(): void
    {
        $this->copy($this->ada);
        $this->at('2027-03-01T10:30:00Z');
        $this->as($this->owner, 'POST', $this->briefingPath($this->ada, 'sent'));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame([
            'briefing' => 'sent',
            'briefingCopy' => ['by' => 'Ifeoma Nduka', 'at' => '2027-03-01T11:30:00+01:00', 'marked' => true],
            'link' => 'sent',
        ], $this->row($this->ada));
    }

    #[Test]
    public function markAsSentWithNoBriefingCopyIsRefusedAndALinkColumnCopyIsNotOne(): void
    {
        $this->as($this->owner, 'POST', $this->path($this->ada . '/link'));
        $this->as($this->owner, 'POST', $this->briefingPath($this->ada, 'sent'));

        self::assertSame(409, $this->statusCode());
        self::assertSame(self::service(TranslatorInterface::class)->trans('staff.briefing_not_copied', [], null, 'en'), $this->last()['detail'] ?? null);
        self::assertSame('none', $this->row($this->ada)['briefing']);
    }

    #[Test]
    public function aLinkColumnMarkAsSentChangesTheLinkStateOnly(): void
    {
        $this->as($this->owner, 'POST', $this->path($this->ada . '/link'));
        $this->as($this->owner, 'POST', $this->path($this->ada . '/link/sent'));

        self::assertSame(['briefing' => 'none', 'briefingCopy' => null, 'link' => 'sent'], $this->row($this->ada));
    }

    #[Test]
    public function anOpenAfterABriefingCopyReadsReadMarkedOrNot(): void
    {
        $token = self::token($this->copy($this->ada));
        $this->at('2027-03-06T17:00:00Z');
        $this->open($token);

        self::assertSame('read', $this->row($this->ada)['briefing']);
        self::assertSame('opened', $this->row($this->ada)['link']);
    }

    #[Test]
    public function anOpenAfterALinkColumnCopyAloneLeavesTheBriefingNotSent(): void
    {
        $answer = $this->as($this->owner, 'POST', $this->path($this->ada . '/link'));
        $this->at('2027-03-06T17:00:00Z');
        $this->open(self::token(Type\string()->coerce($answer['url'] ?? null)));

        self::assertSame(['briefing' => 'none', 'briefingCopy' => null, 'link' => 'opened'], $this->row($this->ada));
    }

    #[Test]
    public function aMovedShiftSetsChangedSinceSentForABriefedPerson(): void
    {
        $this->briefed($this->ada);
        $this->as($this->owner, 'PUT', $this->path('shifts/' . $this->shiftId), ['startsAt' => '2027-03-06T19:00', 'endsAt' => '2027-03-06T23:00', 'needed' => 1]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame('changed', $this->row($this->ada)['briefing']);
    }

    #[Test]
    public function aNewFloorLeadSetsChangedSinceSentForABriefedPerson(): void
    {
        $bisi = $this->person('Bisi Ola', '0803 111 0010');
        $this->briefed($this->ada);
        $this->as($this->owner, 'PUT', '/api/events/' . $this->eventId . '/stations/floor-lead', ['lead' => $bisi]);
        self::assertLessThan(300, $this->statusCode(), Json\encode($this->last()));

        self::assertSame('changed', $this->row($this->ada)['briefing']);
        self::assertSame('none', $this->row($bisi)['briefing']);
    }

    #[Test]
    public function changingTheRulesSetsNoChangedSinceSent(): void
    {
        $this->briefed($this->ada);
        $this->as($this->owner, 'PUT', $this->rulesPath(), ['rules' => 'Black shirts.']);

        self::assertSame('sent', $this->row($this->ada)['briefing']);
    }

    #[Test]
    public function aChangedPersonMarkedAsSentAgainReadsSentAndAnOpenReadsRead(): void
    {
        $this->briefed($this->ada);
        $this->as($this->owner, 'PUT', $this->path('shifts/' . $this->shiftId), ['startsAt' => '2027-03-06T19:00', 'endsAt' => '2027-03-06T23:00', 'needed' => 1]);
        $token = self::token($this->copy($this->ada));
        self::assertSame(['by' => 'Ifeoma Nduka', 'at' => '2027-03-01T11:00:00+01:00', 'marked' => false], $this->row($this->ada)['briefingCopy']);
        $this->as($this->owner, 'POST', $this->briefingPath($this->ada, 'sent'));
        self::assertSame('sent', $this->row($this->ada)['briefing']);

        $this->at('2027-03-06T17:00:00Z');
        $this->open($token);

        self::assertSame('read', $this->row($this->ada)['briefing']);
    }

    #[Test]
    public function theRulesAreSavedTrimmedOnTheRosterAndOnTheShiftPage(): void
    {
        $this->as($this->owner, 'PUT', $this->rulesPath(), ['rules' => "  Black shirts.\nPhones stay in the staff room.\n"]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame("Black shirts.\nPhones stay in the staff room.", $this->as($this->owner, 'GET', $this->path(''))['rules'] ?? null);
        self::assertSame("Black shirts.\nPhones stay in the staff room.", $this->as($this->owner, 'GET', $this->path($this->ada . '/preview'))['rules'] ?? null);
    }

    #[Test]
    public function blankRulesAreNone(): void
    {
        $this->as($this->owner, 'PUT', $this->rulesPath(), ['rules' => 'Black shirts.']);
        $this->as($this->owner, 'PUT', $this->rulesPath(), ['rules' => "  \n"]);

        $roster = $this->as($this->owner, 'GET', $this->path(''));
        self::assertArrayHasKey('rules', $roster);
        self::assertNull($roster['rules']);
    }

    #[Test]
    public function theRulesCountCodePointsSoTwoThousandFitAndOneMoreIsRefused(): void
    {
        $fits = Str\repeat('Ọ̀', 1000);
        $this->as($this->owner, 'PUT', $this->rulesPath(), ['rules' => $fits]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->as($this->owner, 'PUT', $this->rulesPath(), ['rules' => $fits . 'a']);
        self::assertSame(422, $this->statusCode());
        $violation = Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true)->coerce(Type\vec(Type\mixed())->coerce($this->last()['violations'] ?? null)[0] ?? null);
        self::assertSame('rules', $violation['propertyPath']);
        self::assertSame(self::service(TranslatorInterface::class)->trans('validation.staff_rules_too_long', ['{max}' => (string) Event::STAFF_RULES_MAXIMUM], null, 'en'), $violation['message']);
        self::assertSame($fits, $this->as($this->owner, 'GET', $this->path(''))['rules'] ?? null);
    }

    #[Test]
    public function aPreviewRecordsNothing(): void
    {
        $this->copy($this->ada);
        $this->at('2027-03-06T17:00:00Z');
        $preview = $this->as($this->owner, 'GET', $this->path($this->ada . '/preview'));

        self::assertSame(200, $this->statusCode(), Json\encode($preview));
        self::assertSame('Bartender', Type\shape(['job' => Type\string()], true)->coerce($preview['shift'] ?? null)['job']);
        $row = $this->row($this->ada);
        self::assertSame('none', $row['briefing']);
        self::assertSame('copied', $row['link']);
    }

    #[Test]
    public function aPreviewOfSomeoneWithNoShiftHasNoShift(): void
    {
        $bisi = $this->person('Bisi Ola', '0803 111 0010');
        $preview = $this->as($this->owner, 'GET', $this->path($bisi . '/preview'));

        self::assertSame(200, $this->statusCode(), Json\encode($preview));
        self::assertArrayHasKey('shift', $preview);
        self::assertNull($preview['shift']);
    }

    #[Test]
    public function staffReadSeesTheStatesAndPreviewsButCopiesMarksAndEditsNothing(): void
    {
        $viewer = $this->member('viewer@ire.events', 'Bisi Ola', EventRole::CanView);

        $this->as($viewer, 'GET', $this->path($this->ada . '/preview'));
        self::assertSame(200, $this->statusCode());
        self::assertSame('none', $this->rowAs($viewer, $this->ada)['briefing']);

        foreach (['link', 'sent'] as $what) {
            $this->as($viewer, 'POST', $this->briefingPath($this->ada, $what));
            self::assertSame(403, $this->statusCode(), $what);
        }

        $this->as($viewer, 'PUT', $this->rulesPath(), ['rules' => 'Mine now.']);
        self::assertSame(403, $this->statusCode());
        self::assertSame([], self::em()->getRepository(StaffLinkToken::class)->findAll());
    }

    #[Test]
    public function withoutStaffReadThePreviewIsRefused(): void
    {
        $outsider = $this->member('floor@ire.events', 'Kunle Ade', EventRole::CanWorkFloor);

        $this->as($outsider, 'GET', $this->path($this->ada . '/preview'));

        self::assertSame(403, $this->statusCode());
    }

    #[Test]
    public function markAsSentAndTheRulesAreAuditedWithoutTheRulesText(): void
    {
        $this->copy($this->ada);
        $this->as($this->owner, 'POST', $this->briefingPath($this->ada, 'sent'));
        $this->as($this->owner, 'PUT', $this->rulesPath(), ['rules' => 'A secret handshake.']);
        $audit = Json\encode(self::em()->getConnection()->fetchAllAssociative('SELECT * FROM audit_entries'));

        self::assertTrue(Str\contains($audit, 'staff.briefing_marked_sent'));
        self::assertTrue(Str\contains($audit, 'staff.rules_changed'));
        self::assertFalse(Str\contains($audit, 'secret handshake'));
    }

    private function briefed(string $staffId): void
    {
        $this->copy($staffId);
        $this->as($this->owner, 'POST', $this->briefingPath($staffId, 'sent'));
        self::assertSame('sent', $this->row($staffId)['briefing']);
    }

    private function copy(string $staffId): string
    {
        $answer = $this->as($this->owner, 'POST', $this->briefingPath($staffId, 'link'));
        self::assertSame(200, $this->statusCode(), Json\encode($answer));

        return Type\string()->coerce($answer['url'] ?? null);
    }

    private function open(#[SensitiveParameter] string $token): void
    {
        $this->client->request('POST', '/api/staff-links/opened', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode(['token' => $token]));
        self::assertSame(200, $this->statusCode(), (string) $this->client->getResponse()->getContent());
    }

    private function at(string $instant): void
    {
        self::mockTime(new DateTimeImmutable($instant));
    }

    private static function token(string $url): string
    {
        return Str\after_last($url, '/') ?? self::fail('no token in ' . $url);
    }

    /** @return array{briefing: string, briefingCopy: mixed, link: string} */
    private function row(string $staffId): array
    {
        return $this->rowAs($this->owner, $staffId);
    }

    /** @return array{briefing: string, briefingCopy: mixed, link: string} */
    private function rowAs(User $user, string $staffId): array
    {
        $staff = Type\vec(Type\shape([
            'id' => Type\string(),
            'briefing' => Type\string(),
            'briefingCopy' => Type\mixed(),
            'link' => Type\string(),
        ], true))->coerce($this->as($user, 'GET', $this->path(''))['staff'] ?? null);

        $row = Iter\search($staff, static fn (array $one): bool => $one['id'] === $staffId) ?? self::fail('nobody ' . $staffId);

        return ['briefing' => $row['briefing'], 'briefingCopy' => $row['briefingCopy'], 'link' => $row['link']];
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

        return Type\shape(['id' => Type\string()], true)->coerce(Type\vec(Type\mixed())->coerce($this->last()['shifts'] ?? null)[0] ?? null)['id'];
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

    private function briefingPath(string $staffId, string $what): string
    {
        return $this->path($staffId . '/briefing/' . $what);
    }

    private function rulesPath(): string
    {
        return '/api/events/' . $this->eventId . '/briefing/rules';
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
