<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Event\People\OutsideAccess;
use App\Domain\Event\Timeline\Model\Milestone;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\EventPerson;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\PhoneNumber;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\MilestoneOwner;
use App\Enum\Permission;
use App\Enum\PermissionArea;
use App\Enum\SeededRole;
use App\Http\Access\Grants;
use App\Tests\ApiTestCase;
use App\Tests\Double\ScriptedMilestones;
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

/** sc-71: someone from outside the organisation on one event, through People, and nothing beyond it. */
final class OutsideAccessTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string UNUSABLE = 'That is not an email address or a mobile number we can use.';

    private User $owner;

    private Organisation $organisation;

    private string $owambe;

    private string $naming;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = $this->account('owner@ire.events', 'Ìrè Owner');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->owambe = $this->create($this->owner, $this->organisation, 'Owambe', '2030-11-14T16:00');
        $this->naming = $this->create($this->owner, $this->organisation, 'Naming', '2030-11-21T16:00');
    }

    #[Test]
    public function someoneFromOutsideReachesOnlyTheNamedEventAndNothingOfTheOrganisation(): void
    {
        $caterer = $this->account('bisi@lagoslights.example', 'Bisi');
        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', 'can_view', 'Bar and drinks');
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        $this->as($caterer, 'GET', '/api/events/' . $this->owambe);
        self::assertSame(200, $this->statusCode());

        $this->as($caterer, 'GET', '/api/events/' . $this->naming);
        self::assertSame(404, $this->statusCode(), 'a sibling event in the same organisation');
        self::assertSame(ErrorCode::NotFound->type(), $this->last()['type'] ?? null);

        $organisation = '/api/orgs/' . $this->organisation->getId()->toRfc4122();
        foreach (['/events', '/members', '/roles'] as $rest) {
            $this->as($caterer, 'GET', $organisation . $rest);
            self::assertSame(404, $this->statusCode(), $rest);
        }

        $people = $this->as($caterer, 'GET', '/api/events/' . $this->owambe . '/people');
        self::assertSame(200, $this->statusCode());
        self::assertSame([], $people['owners'], 'no names from the member list beyond the event');
        self::assertSame([], $people['admins']);
    }

    #[Test]
    public function aGrantIsHeldByTheAccountOnEveryDeviceAndNamesWhoGrantedIt(): void
    {
        $caterer = $this->account('bisi@lagoslights.example', 'Bisi');
        $this->grant($this->owner, $this->owambe, 'BISI@lagoslights.example', 'can_check_in', 'Kitchen');

        $person = $this->outsider($this->owambe, $caterer) ?? self::fail('no grant');
        self::assertNull($person->getMembership());
        self::assertSame(EventRole::CanCheckIn, $person->getRole());
        self::assertSame('Kitchen', $person->getJobLabel());
        self::assertTrue($person->getGrantedBy()?->getId()->equals($this->owner->getId()));

        foreach ([$this->tokenFor($caterer), $this->tokenFor($caterer)] as $device) {
            $this->client->request('GET', '/api/events/' . $this->owambe, server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $device]);
            self::assertSame(200, $this->statusCode());
        }

        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'event_person.granted']) ?? self::fail('not audited');
        self::assertSame([null, 'can_check_in'], $entry->getChanges()['role'] ?? null);
    }

    #[Test]
    public function revocationTakesEffectOnTheHoldersNextRequestAsNotFound(): void
    {
        $caterer = $this->account('bisi@lagoslights.example', 'Bisi');
        $token = $this->tokenFor($caterer);
        $id = $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', 'can_edit');

        $this->client->request('GET', '/api/events/' . $this->owambe, server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $token]);
        self::assertSame(200, $this->statusCode());

        $this->as($this->owner, 'DELETE', '/api/events/' . $this->owambe . '/people/' . $id);
        self::assertSame(204, $this->statusCode());

        $this->client->request('GET', '/api/events/' . $this->owambe, server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $token]);
        self::assertSame(404, $this->statusCode(), 'the same token, signed in still');
        $answer = fn (): array => [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['detail'] ?? null];
        $revoked = $answer();
        $this->client->request('GET', '/api/events/019a0000-0000-7000-8000-000000000000', server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $token]);
        self::assertSame($answer(), $revoked, 'the same answer as an event that does not exist');
        self::assertNotNull(self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'event_person.revoked']));
    }

    #[Test]
    public function aGrantEndsWhenTheEventConcludesAndTheEndingIsAudited(): void
    {
        $caterer = $this->account('bisi@lagoslights.example', 'Bisi');
        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', 'can_view');
        $row = $this->row($this->as($this->owner, 'GET', '/api/events/' . $this->owambe . '/people'), 'Bisi');
        self::assertNotNull($row['endsAt'], 'never open-ended');

        self::mockTime(new DateTimeImmutable('2030-11-15T00:00:00+00:00'));
        $this->as($caterer, 'GET', '/api/events/' . $this->owambe);
        self::assertSame(404, $this->statusCode(), 'over at its end, before anything tidies it');
        self::assertSame([], $this->as($caterer, 'GET', '/api/auth/me')['outsideEvents']);

        self::assertSame(1, self::service(OutsideAccess::class)->endConcluded());
        self::assertNull($this->outsider($this->owambe, $caterer));
        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'event_person.expired']) ?? self::fail('not audited');
        self::assertSame([null, $this->owambe], $entry->getChanges()['eventId'] ?? null);
    }

    #[Test]
    public function eventsReachedFromOutsideComeSoonestFirstThenByTheGrantMadeFirst(): void
    {
        $later = $this->create($this->owner, $this->organisation, 'Later', '2031-01-10T16:00');
        $sameStart = $this->create($this->owner, $this->organisation, 'Same start', '2030-11-14T16:00');
        $caterer = $this->account('bisi@lagoslights.example', 'Bisi');

        $this->grant($this->owner, $later, 'bisi@lagoslights.example', 'can_view');
        $this->grant($this->owner, $sameStart, 'bisi@lagoslights.example', 'can_view');
        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', 'can_edit');

        $me = $this->as($caterer, 'GET', '/api/auth/me');
        self::assertSame(['Same start', 'Owambe', 'Later'], Vec\map(Type\vec(Type\shape(['name' => Type\string()], true))->coerce($me['outsideEvents']), static fn (array $event): string => $event['name']));
    }

    #[Test]
    public function grantsInTwoOrganisationsStayInvisibleToEachOther(): void
    {
        $other = $this->account('owner@ayo.events', 'Ayo Owner');
        $ayo = self::service(OrganisationFounder::class)->found($other, 'Ayo Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $wedding = $this->create($other, $ayo, 'Wedding', '2030-12-05T16:00');
        $caterer = $this->account('bisi@lagoslights.example', 'Bisi');

        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', 'can_view');
        $this->grant($other, $wedding, 'bisi@lagoslights.example', 'can_edit');

        $me = $this->as($caterer, 'GET', '/api/auth/me');
        self::assertFalse($me['needsOrganisation']);
        self::assertEqualsCanonicalizing(['Owambe', 'Wedding'], Vec\map(Type\vec(Type\shape(['name' => Type\string()], true))->coerce($me['outsideEvents']), static fn (array $event): string => $event['name']));

        foreach ([[$this->owner, $this->owambe, $wedding, 'Ayo Events'], [$other, $wedding, $this->owambe, 'Ìrè Events']] as [$owner, $theirs, $notTheirs, $otherName]) {
            $people = Json\encode($this->as($owner, 'GET', '/api/events/' . $theirs . '/people'));
            self::assertStringNotContainsString($notTheirs, $people);
            self::assertStringNotContainsString($otherName, $people);
            $this->as($owner, 'GET', '/api/events/' . $notTheirs . '/people');
            self::assertSame(404, $this->statusCode());
        }
    }

    #[Test]
    public function aMembersOwnAccessIsUntouchedAndAMemberIsNeverGrantedFromOutside(): void
    {
        $member = $this->member('member@ire.events', SeededRole::Member, 'Ada');
        self::onEvent($member, $this->owambe, EventRole::Lead);

        $this->grant($this->owner, $this->owambe, 'member@ire.events', 'can_view');
        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::AlreadyAMember->type(), $this->last()['type'] ?? null);
        $this->grant($this->owner, $this->naming, 'member@ire.events', 'can_view');
        self::assertSame(409, $this->statusCode(), 'on an event they have no role on either');

        $outsider = $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', 'can_view');
        $this->as($member, 'PATCH', '/api/events/' . $this->owambe . '/people/' . $outsider, ['role' => 'can_edit']);
        self::assertSame(200, $this->statusCode(), 'their Lead still changes People');
        $this->as($member, 'GET', '/api/events/' . $this->naming);
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function anOutsiderWhoJoinsTheOrganisationNoLongerReachesItsEventsFromOutside(): void
    {
        $caterer = $this->account('bisi@lagoslights.example', 'Bisi');
        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', 'can_view');
        self::assertCount(1, Type\vec(Type\mixed())->coerce($this->as($caterer, 'GET', '/api/auth/me')['outsideEvents']));

        $this->join($caterer, SeededRole::Member);

        self::assertSame([], $this->as($caterer, 'GET', '/api/auth/me')['outsideEvents']);
    }

    #[Test]
    public function aMemberOfAnotherOrganisationIsToldOfTheEventsTheyReachFromOutside(): void
    {
        $other = $this->account('owner@ayo.events', 'Ayo Owner');
        self::service(OrganisationFounder::class)->found($other, 'Ayo Events', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $this->grant($this->owner, $this->owambe, 'owner@ayo.events', 'can_view');

        self::assertSame(['Owambe'], Vec\map(Type\vec(Type\shape(['name' => Type\string()], true))->coerce($this->as($other, 'GET', '/api/auth/me')['outsideEvents']), static fn (array $event): string => $event['name']));
    }

    /** @return iterable<string, array{string, bool}> each level, and whether it edits guests */
    public static function levels(): iterable
    {
        yield 'Can edit the event' => ['can_edit', true];
        yield 'Can view' => ['can_view', false];
        yield 'Can check guests in' => ['can_check_in', false];
    }

    #[Test]
    #[DataProvider('levels')]
    public function eachLevelOnTheGuestsPageAndItsExport(string $level, bool $edits): void
    {
        $this->as($this->owner, 'POST', '/api/events/' . $this->owambe . '/guests', ['fullName' => 'Funmi Adeyemi', 'email' => 'funmi@example.com']);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $caterer = $this->account('bisi@lagoslights.example', 'Bisi');
        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', $level);

        $guests = Json\encode($this->as($caterer, 'GET', '/api/events/' . $this->owambe . '/guests'));
        self::assertSame(200, $this->statusCode());
        self::assertStringContainsString('Funmi Adeyemi', $guests);
        self::assertSame($edits, Str\contains($guests, 'funmi@example.com'), 'contact details go with Can edit the event only');

        $this->as($caterer, 'POST', '/api/events/' . $this->owambe . '/guests', ['fullName' => 'Kola']);
        self::assertSame($edits ? 201 : 403, $this->statusCode());

        $this->client->request('POST', '/api/events/' . $this->owambe . '/guests/export', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . $this->tokenFor($caterer),
        ], content: Json\encode(['format' => 'csv', 'scope' => 'all', 'people' => []]));
        self::assertSame($edits ? 200 : 403, $this->statusCode());
    }

    #[Test]
    #[DataProvider('levels')]
    public function noLevelHoldsAnyBudgetPermission(string $level): void
    {
        $held = EventRole::from($level)->permissions();

        foreach ([Permission::BudgetRead, Permission::BudgetManage, Permission::BudgetMargin] as $budget) {
            self::assertNotContains($budget, $held, $budget->value);
        }
        self::assertSame([], Vec\filter($held, static fn (Permission $permission): bool => PermissionArea::Budget === $permission->area() || $permission->isAdministrative()));
    }

    /** @return iterable<string, array{string, list<string>}> each level, and the areas whose milestones its Needs you shows */
    public static function areasByLevel(): iterable
    {
        yield 'Can edit the event' => ['can_edit', ['guests', 'menu', 'seating', 'run_of_show', 'staff', 'messages', 'reports']];
        yield 'Can view' => ['can_view', ['guests', 'seating', 'run_of_show']];
        yield 'Can check guests in' => ['can_check_in', ['guests', 'seating', 'run_of_show']];
    }

    /** @param list<string> $shown */
    #[Test]
    #[DataProvider('areasByLevel')]
    public function needsYouListsOnlyTheAreasTheLevelOpensAndNeverBudget(string $level, array $shown): void
    {
        foreach ([PermissionArea::Guests, PermissionArea::Menu, PermissionArea::Seating, PermissionArea::RunOfShow, PermissionArea::Staff, PermissionArea::Messages, PermissionArea::Reports, PermissionArea::Budget] as $area) {
            self::service(ScriptedMilestones::class)->add($this->owambe, new Milestone($area->value . '.due', new DateTimeImmutable('2030-11-01T09:00:00+01:00'), $area->value . ' due', null, MilestoneOwner::You, $area));
        }
        $caterer = $this->account('bisi@lagoslights.example', 'Bisi');
        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', $level);

        $timeline = Type\shape(['milestones' => Type\vec(Type\shape(['area' => Type\string()], true))], true)->coerce($this->as($caterer, 'GET', '/api/events/' . $this->owambe . '/timeline'));
        self::assertSame(200, $this->statusCode());
        $areas = Vec\map($timeline['milestones'], static fn (array $milestone): string => $milestone['area']);
        self::assertSame($shown, Vec\values(Vec\filter($areas, static fn (string $area): bool => 'events' !== $area)));
    }

    #[Test]
    #[DataProvider('levels')]
    public function noLevelDuplicatesOrDeletesTheEvent(string $level): void
    {
        $caterer = $this->account('bisi@lagoslights.example', 'Bisi');
        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', $level);

        $this->as($caterer, 'POST', '/api/events/' . $this->owambe . '/duplicate', ['name' => 'Owambe again', 'startsAt' => '2030-12-14T16:00', 'endsAt' => '2030-12-14T16:00']);
        self::assertSame(403, $this->statusCode(), Json\encode($this->last()));
        $this->as($caterer, 'DELETE', '/api/events/' . $this->owambe);
        self::assertSame(403, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function anAccountInNoOrganisationLandsInsideItsEvent(): void
    {
        $caterer = $this->account('bisi@lagoslights.example', 'Bisi', detailsSaved: false);
        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', 'can_check_in', 'Kitchen');

        $me = $this->as($caterer, 'GET', '/api/auth/me');
        self::assertFalse($me['needsOrganisation'], 'never asked to start an organisation');
        self::assertSame([[
            'id' => $this->owambe,
            'name' => 'Owambe',
            'organisationName' => 'Ìrè Events',
            'role' => 'can_check_in',
            'jobLabel' => 'Kitchen',
            'startsAt' => '2030-11-14T16:00:00+01:00',
        ]], Vec\map(Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($me['outsideEvents']), static fn (array $event): array => [
            'id' => $event['id'],
            'name' => $event['name'],
            'organisationName' => $event['organisationName'],
            'role' => $event['role'],
            'jobLabel' => $event['jobLabel'],
            'startsAt' => $event['startsAt'],
        ]));
    }

    #[Test]
    public function aPendingAddressIsShownOnlyToWhoeverManagesPeople(): void
    {
        $admin = $this->member('admin@ire.events', SeededRole::Admin, 'Admin');
        $lead = $this->member('lead@ire.events', SeededRole::Member, 'Lead');
        self::onEvent($lead, $this->owambe, EventRole::Lead);
        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', 'can_view');
        $this->grant($this->owner, $this->owambe, '0803 555 0142', 'can_view');

        foreach (['Owner' => $this->owner, 'Admin' => $admin, 'Lead' => $lead] as $as => $who) {
            $pending = $this->pending($this->as($who, 'GET', '/api/events/' . $this->owambe . '/people'));
            self::assertEqualsCanonicalizing([['bisi@lagoslights.example', 'email'], ['+2348035550142', 'mobile']], $pending, $as);
        }

        $caterer = $this->account('caterer@else.example', 'Caterer');
        $this->grant($this->owner, $this->owambe, 'caterer@else.example', 'can_view');
        foreach (['can_edit', 'can_view', 'can_check_in'] as $level) {
            $member = $this->member($level . '@ire.events', SeededRole::Member, $level);
            self::onEvent($member, $this->owambe, EventRole::from($level));

            foreach ([$member, $caterer] as $who) {
                $people = $this->as($who, 'GET', '/api/events/' . $this->owambe . '/people');
                self::assertSame([[null, null], [null, null]], $this->pending($people), $level);
                self::assertStringNotContainsString('lagoslights', Json\encode($people));
                self::assertStringNotContainsString('0142', Json\encode($people));
            }
        }
    }

    #[Test]
    public function anAddressTakesTheirNameOnceAnAccountProvesIt(): void
    {
        $this->grant($this->owner, $this->owambe, 'Bisi@LagosLights.example', 'can_view', 'Bar and drinks');
        $people = $this->as($this->owner, 'GET', '/api/events/' . $this->owambe . '/people');
        self::assertSame([['bisi@lagoslights.example', 'email']], $this->pending($people), Json\encode($people));

        $caterer = $this->account('bisi@lagoslights.example', 'Bisi');
        $this->as($caterer, 'GET', '/api/events/' . $this->owambe);
        self::assertSame(404, $this->statusCode(), 'not before the account is read');

        self::assertCount(1, Type\vec(Type\mixed())->coerce($this->as($caterer, 'GET', '/api/auth/me')['outsideEvents']));
        $this->as($caterer, 'GET', '/api/events/' . $this->owambe);
        self::assertSame(200, $this->statusCode());
        $row = $this->row($this->as($this->owner, 'GET', '/api/events/' . $this->owambe . '/people'), 'Bisi');
        self::assertTrue($row['outside']);
        self::assertNull($row['address']);
        self::assertSame('Bar and drinks', $row['jobLabel']);
        self::assertNotNull(self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => 'event_person.claimed']));
    }

    #[Test]
    public function aSecondAddOfSomeoneOnTheEventIsRefused(): void
    {
        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', 'can_view');
        $this->grant($this->owner, $this->owambe, 'BISI@lagoslights.example ', 'can_edit');
        self::assertSame(422, $this->statusCode(), 'by address, ignoring case');
        self::assertSame('They already have a role on this event. Change it instead.', $this->violation());

        $this->grant($this->owner, $this->owambe, '+234 803 555 0142', 'can_view');
        $this->grant($this->owner, $this->owambe, '0803 555 0142', 'can_view');
        self::assertSame(422, $this->statusCode(), 'one number, national and international');

        $this->account('kemi@example.com', 'Kemi');
        $this->grant($this->owner, $this->owambe, 'kemi@example.com', 'can_view');
        self::assertSame(201, $this->statusCode());
        $this->grant($this->owner, $this->owambe, 'kemi@example.com', 'can_view');
        self::assertSame(422, $this->statusCode(), 'by account');
    }

    #[Test]
    public function aMobileNumberIsReadForTheOrganisationsCountryUnlessItStartsWithPlus(): void
    {
        $this->grant($this->owner, $this->owambe, '0803 555 0142', 'can_view');
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $this->grant($this->owner, $this->owambe, '+351 912 345 678', 'can_view');
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        $numbers = Vec\map($this->pending($this->as($this->owner, 'GET', '/api/events/' . $this->owambe . '/people')), static fn (array $pair): ?string => $pair[0]);
        self::assertEqualsCanonicalizing(['+2348035550142', '+351912345678'], $numbers);

        $tunde = $this->account('tunde@example.com', 'Tunde');
        $phone = new PhoneNumber($tunde, '+2348035550142', isPrimary: true, countryCode: 'NG');
        $phone->setVerifiedAt(new DateTimeImmutable());
        self::em()->persist($phone);
        self::em()->flush();
        $this->as($tunde, 'GET', '/api/auth/me');
        $this->as($tunde, 'GET', '/api/events/' . $this->owambe);
        self::assertSame(200, $this->statusCode(), 'their proved number claims the grant');
    }

    /** @return iterable<string, array{string, string}> */
    public static function refusedForms(): iterable
    {
        yield 'empty' => ['  ', 'Enter their email address or mobile number.'];
        yield 'a broken email address' => ['bisi@', self::UNUSABLE];
        yield 'too few digits' => ['0803 555', self::UNUSABLE];
        yield '00 is not +' => ['00351912345678', self::UNUSABLE];
    }

    #[Test]
    #[DataProvider('refusedForms')]
    public function theFormChecksAreTheServersToo(string $typed, string $refusal): void
    {
        $this->grant($this->owner, $this->owambe, $typed, 'can_view');
        self::assertSame(422, $this->statusCode());
        self::assertSame($refusal, $this->violation());
    }

    #[Test]
    public function leadIsForMembersOnly(): void
    {
        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', 'lead');
        self::assertSame(422, $this->statusCode());
        self::assertSame('For members of Ìrè Events only.', $this->violation());

        $id = $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', 'can_view');
        $this->as($this->owner, 'PATCH', '/api/events/' . $this->owambe . '/people/' . $id, ['role' => 'lead']);
        self::assertSame(422, $this->statusCode(), 'nor changed to it');
    }

    /** @return iterable<string, array{string}> */
    public static function readingLevels(): iterable
    {
        yield 'Can view' => ['can_view'];
        yield 'Can check guests in' => ['can_check_in'];
    }

    /** sc-94342: Menu, Messages and Staff refuse a reading level from outside as Budget does, reads included, and the refusal carries nothing of the area. */
    #[Test]
    #[DataProvider('readingLevels')]
    public function aReadingLevelFromOutsideIsRefusedEveryAreaItDoesNotOpen(string $level): void
    {
        $organisation = '/api/orgs/' . $this->organisation->getId()->toRfc4122();
        $this->as($this->owner, 'POST', $organisation . '/dishes', ['name' => 'Jollof rice', 'allergens' => ['celery']]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $caterer = $this->account('bisi@lagoslights.example', 'Bisi');
        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', $level);
        $event = '/api/events/' . $this->owambe;
        $someId = '0190a1b2-0000-7000-8000-000000000000';

        $routes = [
            ['GET', $event . '/messages'],
            ['GET', $event . '/messages/' . $someId],
            ['POST', $event . '/messages/subscriptions'],
            ['GET', $event . '/menu'],
            ['GET', $event . '/menu/picks'],
            ['GET', $event . '/menu/asked-again'],
            ['GET', $event . '/menu/preview'],
            ['GET', $event . '/menu/kitchen-sheet'],
            ['POST', $event . '/menu/kitchen-sheet/pdf'],
            ['POST', $event . '/menu/subscriptions'],
            ['PUT', $event . '/menu/picks/people/' . $someId . '/courses/' . $someId],
            ['PUT', $event . '/menu/picks/variants/' . $someId],
            ['GET', $organisation . '/dishes'],
            ['GET', $event . '/staff'],
            ['POST', $event . '/staff/subscriptions'],
            ['GET', $event . '/budget'],
        ];
        foreach ($routes as [$method, $path]) {
            $refusal = $this->as($caterer, $method, $path, 'GET' === $method ? null : []);
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
            self::assertSame(ErrorCode::PermissionRequired->type(), $refusal['type'] ?? null, $method . ' ' . $path);
            self::assertStringNotContainsString('Jollof', Json\encode($refusal), $path);
            self::assertSame([], Vec\filter(Vec\keys($refusal), static fn (string $key): bool => !Iter\contains(['type', 'title', 'status', 'detail', 'code', 'permission', 'instance', 'correlationId'], $key)), $path);
        }
    }

    /** sc-94342: by area, not route, so Reports and any area added later is closed from outside with nothing added to its routes. */
    #[Test]
    #[DataProvider('readingLevels')]
    public function aReadingLevelFromOutsideHoldsOnlyThePermissionsOfTheAreasItOpens(string $level): void
    {
        $role = EventRole::from($level);
        $grants = Grants::fromOutside($role);

        foreach (Permission::cases() as $permission) {
            if ($grants->holds($permission)) {
                self::assertContains($permission->area(), $role->areasFromOutside(), $permission->value);
            }
        }
        self::assertFalse($grants->holds(Permission::ReportsRead));
        self::assertTrue(Grants::onEvent($role)->holds(Permission::MessagesRead), 'a Member at the same level still reads Messages');

        $caterer = $this->account('bisi@lagoslights.example', 'Bisi');
        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', $level);
        $event = Type\shape(['event' => Type\shape(['permissions' => Type\vec(Type\string())], true)], true)->coerce($this->as($caterer, 'GET', '/api/events/' . $this->owambe));
        $expected = ['events.read', 'guests.read', 'seating.read', 'run_of_show.read', 'people.read', ...('can_check_in' === $level ? ['guests.check_in'] : [])];
        self::assertEqualsCanonicalizing($expected, $event['event']['permissions']);
    }

    /** sc-95116: from outside, Can edit the event adds a dish kept to the event and never reads or adds to the library. */
    #[Test]
    public function fromOutsideADishAddedToTheMenuStaysOnTheEvent(): void
    {
        $organisation = '/api/orgs/' . $this->organisation->getId()->toRfc4122();
        $jollof = $this->as($this->owner, 'POST', $organisation . '/dishes', ['name' => 'Jollof rice', 'allergens' => ['celery']]);
        self::assertSame(201, $this->statusCode(), Json\encode($jollof));
        $libraryDishId = Type\shape(['dish' => Type\shape(['id' => Type\string()], true)], true)->coerce($jollof)['dish']['id'];
        $menu = '/api/events/' . $this->owambe . '/menu';
        $course = Type\shape(['courseId' => Type\string()], true)->coerce($this->as($this->owner, 'POST', $menu . '/courses', ['name' => 'Main']))['courseId'];
        $dishes = $menu . '/courses/' . $course . '/dishes';
        $caterer = $this->account('bisi@lagoslights.example', 'Bisi');
        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', 'can_edit');

        foreach ([['name' => 'Suya bites', 'allergens' => ['peanuts']], ['name' => 'Suya bites', 'allergens' => ['peanuts'], 'onlyForEvent' => false], ['libraryDishId' => $libraryDishId, 'onlyForEvent' => true], ['libraryDishId' => '0190a1b2-0000-7000-8000-000000000000']] as $body) {
            $refusal = $this->as($caterer, 'POST', $dishes, $body);
            self::assertSame(403, $this->statusCode(), Json\encode($body));
            self::assertSame(ErrorCode::PermissionRequired->type(), $refusal['type'] ?? null);
            self::assertStringNotContainsString('Jollof', Json\encode($refusal));
        }

        $this->as($caterer, 'POST', $dishes, ['name' => 'Jollof rice', 'allergens' => ['celery'], 'onlyForEvent' => true]);
        self::assertSame(201, $this->statusCode(), 'a name the library holds is no question from outside: ' . Json\encode($this->last()));
        $this->as($caterer, 'POST', $dishes, ['name' => 'Suya bites', 'allergens' => ['peanuts'], 'onlyForEvent' => true]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        $onMenu = Type\shape(['menu' => Type\shape(['courses' => Type\vec(Type\shape(['dishes' => Type\vec(Type\shape(['name' => Type\string()], true))], true))], true)], true)->coerce($this->as($this->owner, 'GET', $menu));
        self::assertSame(['Jollof rice', 'Suya bites'], Vec\map($onMenu['menu']['courses'][0]['dishes'], static fn (array $dish): string => $dish['name']));
        $library = Type\shape(['dishes' => Type\vec(Type\shape(['name' => Type\string()], true))], true)->coerce($this->as($this->owner, 'GET', $organisation . '/dishes'));
        self::assertSame(['Jollof rice'], Vec\map($library['dishes'], static fn (array $dish): string => $dish['name']));
    }

    /** @return iterable<string, array{0: string, 1: EventRole}> */
    public static function serviceLevels(): iterable
    {
        yield 'Can work the floor' => ['can_work_floor', EventRole::CanWorkFloor];
        yield 'Can work the pass' => ['can_work_pass', EventRole::CanWorkPass];
        yield 'Can run the floor' => ['can_run_floor', EventRole::CanRunFloor];
    }

    #[Test]
    #[DataProvider('serviceLevels')]
    public function someoneFromOutsideWorksTheServiceAtALevelAndReadsNothingElseOfTheEvent(string $level, EventRole $role): void
    {
        $waiter = $this->account('bisi@lagoslights.example', 'Bisi');
        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', $level, 'Waiter');
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        self::assertSame($role, $this->outsider($this->owambe, $waiter)?->getRole());

        foreach (['/people', '/guests', '/budget'] as $rest) {
            $this->as($waiter, 'GET', '/api/events/' . $this->owambe . $rest);
            self::assertContains($this->statusCode(), [403, 404], $rest);
        }
    }

    #[Test]
    public function aJobLabelPast60CharactersIsRefused(): void
    {
        $this->grant($this->owner, $this->owambe, 'bisi@lagoslights.example', 'can_view', Str\repeat('a', 61));
        self::assertSame(422, $this->statusCode());
    }

    private function grant(User $by, string $eventId, string $address, string $role, ?string $jobLabel = null): string
    {
        $body = $this->as($by, 'POST', '/api/events/' . $eventId . '/people', ['address' => $address, 'role' => $role, 'jobLabel' => $jobLabel]);

        return Type\string()->coerce($body['person']['id'] ?? '');
    }

    /**
     * @param array<string, mixed> $people
     *
     * @return list<array{0: string|null, 1: string|null}>
     */
    private function pending(array $people): array
    {
        $rows = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($people['people'] ?? []);

        return Vec\map(
            Vec\filter($rows, static fn (array $row): bool => null === $row['user']),
            static fn (array $row): array => [Type\nullable(Type\string())->coerce($row['address']), Type\nullable(Type\string())->coerce($row['addressKind'])],
        );
    }

    /** @param array<string, mixed> $people */
    private function row(array $people, string $name): array
    {
        foreach (Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($people['people'] ?? []) as $row) {
            if ($name === (Type\nullable(Type\shape(['name' => Type\string()], true))->coerce($row['user'])['name'] ?? null)) {
                return $row;
            }
        }

        self::fail('nobody called ' . $name);
    }

    private function outsider(string $eventId, User $user): ?EventPerson
    {
        self::em()->clear();

        return self::em()->getRepository(EventPerson::class)->findOneBy(['event' => $eventId, 'user' => $user->getId()]);
    }

    private function violation(): ?string
    {
        $violations = Type\vec(Type\shape(['message' => Type\string()], true))->coerce($this->last()['violations'] ?? []);

        return $violations[0]['message'] ?? null;
    }

    private function create(User $owner, Organisation $organisation, string $name, string $startsAt): string
    {
        $body = $this->as($owner, 'POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', [
            'name' => $name, 'type' => 'wedding', 'startsAt' => $startsAt, 'endsAt' => $startsAt, 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN',
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'])['id'];
    }

    private function account(string $address, string $name, bool $detailsSaved = true): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;

        if ($detailsSaved) {
            self::onboard($user, withOrganisation: false);
        } else {
            $user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
            self::em()->flush();
        }

        return $user;
    }

    private function member(string $address, SeededRole $seeded, string $name): User
    {
        return $this->join($this->account($address, $name), $seeded);
    }

    private function join(User $user, SeededRole $seeded): User
    {
        $user = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $seeded]) ?? self::fail('no role');
        self::em()->persist(new Membership($organisation, $user, $role, MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        return $user;
    }

    private function tokenFor(User $user): string
    {
        return self::service(JWTTokenManagerInterface::class)->create(self::em()->find(User::class, $user->getId()) ?? self::fail('no user'));
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . $this->tokenFor($user),
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
