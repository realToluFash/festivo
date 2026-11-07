<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Messaging\Audience\MemberAudienceResolver;
use App\Domain\Messaging\Model\Audience;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\EventPerson;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/** sc-29912: an organisation's three roles, and what a Member reaches through their roles on events. */
final class EventRolesTest extends ApiTestCase
{
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $owambe;

    private string $naming;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->owambe = $this->create('Owambe', '2030-11-14T16:00');
        $this->naming = $this->create('Naming', '2030-11-21T16:00');
    }

    #[Test]
    public function onlyAnOwnerOrAnAdminStartsAnEvent(): void
    {
        $member = $this->member('member@ire.events', SeededRole::Member);
        $admin = $this->member('admin@ire.events', SeededRole::Admin);
        self::onEvent($member, $this->owambe, EventRole::Lead);

        $this->as($member, 'POST', $this->path('events'), self::valid());
        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::PermissionRequired->type(), $this->last()['type'] ?? null);
        $this->as($member, 'POST', '/api/events/' . $this->owambe . '/duplicate', []);
        self::assertSame(403, $this->statusCode(), 'a copy is a new event too');

        $this->as($admin, 'POST', $this->path('events'), self::valid());
        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function ownersAndAdminsSeeAndChangeEveryEventWithoutARoleOnIt(): void
    {
        $admin = $this->member('admin@ire.events', SeededRole::Admin);

        foreach (['Owner' => $this->owner, 'Admin' => $admin] as $as => $who) {
            self::assertSame('Owambe', $this->listed($who)[0], $as);
            self::assertCount(2, $this->listed($who), $as);
            $this->rename($who, $this->naming, 'Naming, by the ' . $as);
            self::assertSame(200, $this->statusCode(), $as);
        }
    }

    /** Any other event answers as one that does not exist, so its existence is not disclosed (OWASP ASVS 4.0.3 V4.2.1). */
    #[Test]
    public function aMemberReachesOnlyTheEventsTheyHaveARoleOn(): void
    {
        $member = $this->member('member@ire.events', SeededRole::Member);
        self::onEvent($member, $this->owambe, EventRole::CanView);

        self::assertSame(['Owambe'], $this->listed($member));
        self::assertSame(1, $this->last()['total']);
        $this->as($member, 'GET', $this->path('events?finished=true'));
        self::assertSame(0, $this->last()['total']);

        $this->as($member, 'GET', '/api/events/' . $this->owambe);
        self::assertSame(200, $this->statusCode());

        foreach (['', '/timeline', '/mute', '/people'] as $rest) {
            $this->as($member, 'GET', '/api/events/' . $this->naming . $rest);
            self::assertSame(404, $this->statusCode(), $rest);
            self::assertSame(ErrorCode::NotFound->type(), $this->last()['type'] ?? null, $rest);
        }
    }

    #[Test]
    public function aMemberWithNoRoleOnAnyEventListsNone(): void
    {
        $member = $this->member('member@ire.events', SeededRole::Member);

        self::assertSame([], $this->listed($member));
        self::assertSame(0, $this->last()['total']);
    }

    /** @return iterable<string, array{EventRole, int, int}> what changing the event and its People answers */
    public static function eventRoles(): iterable
    {
        yield 'Lead' => [EventRole::Lead, 200, 201];
        yield 'Can edit' => [EventRole::CanEdit, 200, 403];
        yield 'Can view' => [EventRole::CanView, 403, 403];
        yield 'Can check guests in' => [EventRole::CanCheckIn, 403, 403];
    }

    #[Test]
    #[DataProvider('eventRoles')]
    public function eachEventRoleChangesOnlyWhatItHolds(EventRole $role, int $edits, int $addsPeople): void
    {
        $member = $this->member('member@ire.events', SeededRole::Member);
        $other = $this->member('other@ire.events', SeededRole::Member);
        self::onEvent($member, $this->owambe, $role);

        $this->as($member, 'GET', '/api/events/' . $this->owambe . '/people');
        self::assertSame(200, $this->statusCode(), 'everyone on the event reads its People');
        $this->rename($member, $this->owambe, 'Owambe at the lake');
        self::assertSame($edits, $this->statusCode());
        $this->as($member, 'POST', '/api/events/' . $this->owambe . '/people', ['membershipId' => $this->membershipOf($other), 'role' => 'can_view']);
        self::assertSame($addsPeople, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function theEventReadNamesWhatTheCallerHoldsOnIt(): void
    {
        $lead = $this->member('lead@ire.events', SeededRole::Member);
        $viewer = $this->member('viewer@ire.events', SeededRole::Member);
        $admin = $this->member('admin@ire.events', SeededRole::Admin);
        self::onEvent($lead, $this->owambe, EventRole::Lead);
        self::onEvent($viewer, $this->owambe, EventRole::CanView);
        self::onEvent($viewer, $this->naming, EventRole::CanEdit);

        $holds = function (User $who, string $eventId): array {
            $this->as($who, 'GET', '/api/events/' . $eventId);
            self::assertSame(200, $this->statusCode());

            return Type\vec(Type\string())->coerce($this->last()['event']['permissions'] ?? null);
        };

        self::assertContains(Permission::EventsManage->value, $holds($lead, $this->owambe));
        self::assertContains(Permission::PeopleManage->value, $holds($lead, $this->owambe));
        self::assertNotContains(Permission::EventsCreate->value, $holds($lead, $this->owambe), 'a Lead starts no event');
        self::assertNotContains(Permission::EventsManage->value, $holds($viewer, $this->owambe));
        self::assertContains(Permission::EventsRead->value, $holds($viewer, $this->owambe));
        self::assertContains(Permission::EventsManage->value, $holds($viewer, $this->naming), 'each event by its own role');
        self::assertContains(Permission::EventsManage->value, $holds($admin, $this->owambe));
        self::assertContains(Permission::EventsCreate->value, $holds($admin, $this->owambe));

        $this->as($viewer, 'GET', $this->path('events'));
        $listed = Type\vec(Type\shape(['name' => Type\string(), 'permissions' => Type\vec(Type\string())], true))->coerce($this->last()['events']);
        $byName = [];
        foreach ($listed as $event) {
            $byName[$event['name']] = $event['permissions'];
        }
        self::assertNotContains(Permission::EventsManage->value, $byName['Owambe'], 'the list says the same');
        self::assertContains(Permission::EventsManage->value, $byName['Naming']);
    }

    #[Test]
    public function aLeadAddsChangesAndRemovesAMember(): void
    {
        $lead = $this->member('lead@ire.events', SeededRole::Member);
        $tunde = $this->member('tunde@ire.events', SeededRole::Member, 'Tunde Bello');
        self::onEvent($lead, $this->owambe, EventRole::Lead);

        $added = $this->as($lead, 'POST', '/api/events/' . $this->owambe . '/people', ['membershipId' => $this->membershipOf($tunde), 'role' => 'can_check_in', 'jobLabel' => ' Door ']);
        self::assertSame(201, $this->statusCode(), Json\encode($added));
        $person = Type\shape(['id' => Type\string(), 'role' => Type\string(), 'jobLabel' => Type\nullable(Type\string()), 'outside' => Type\bool(), 'user' => Type\shape(['name' => Type\string()], true)], true)->coerce($added['person']);
        self::assertSame(['can_check_in', 'Door', false, 'Tunde Bello'], [$person['role'], $person['jobLabel'], $person['outside'], $person['user']['name']]);

        $this->as($lead, 'POST', '/api/events/' . $this->owambe . '/people', ['membershipId' => $this->membershipOf($tunde), 'role' => 'can_view']);
        self::assertSame(422, $this->statusCode(), 'already on the event');

        $this->as($lead, 'PATCH', '/api/events/' . $this->owambe . '/people/' . $person['id'], ['role' => 'can_edit']);
        self::assertSame(200, $this->statusCode());
        self::assertSame(EventRole::CanEdit, $this->personOf($tunde, $this->owambe)?->getRole());

        $this->as($lead, 'DELETE', '/api/events/' . $this->owambe . '/people/' . $person['id']);
        self::assertSame(204, $this->statusCode());
        self::assertNull($this->personOf($tunde, $this->owambe));
        $this->as($tunde, 'GET', '/api/events/' . $this->owambe);
        self::assertSame(404, $this->statusCode());

        self::assertEqualsCanonicalizing(['event_person.added', 'event_person.changed', 'event_person.removed'], Vec\map(
            self::em()->getRepository(AuditEntry::class)->findBy(['subjectId' => Uuid::fromString($person['id'])]),
            static fn (AuditEntry $entry): string => $entry->getAction(),
        ));
    }

    #[Test]
    public function aLeadFindsWhomToAddByNameAloneAndNeverThemselves(): void
    {
        $lead = $this->member('lead@ire.events', SeededRole::Member, 'Priya Shah');
        $tunde = $this->member('tunde@ire.events', SeededRole::Member, 'Tunde Bello');
        $sade = $this->member('sade@ire.events', SeededRole::Member, 'Sade Okoye');
        $gone = $this->member('gone@ire.events', SeededRole::Member, 'Gone Away');
        self::em()->find(Membership::class, $this->membershipOf($gone))?->setStatus(MembershipStatus::Suspended, new DateTimeImmutable());
        self::em()->flush();
        self::onEvent($lead, $this->owambe, EventRole::Lead);
        self::onEvent($sade, $this->owambe, EventRole::CanView);

        $listed = $this->as($lead, 'GET', '/api/events/' . $this->owambe . '/people/addable');

        self::assertSame(200, $this->statusCode(), Json\encode($listed));
        self::assertEqualsCanonicalizing([
            ['membershipId' => $this->membershipOf($this->owner), 'name' => 'Person'],
            ['membershipId' => $this->membershipOf($tunde), 'name' => 'Tunde Bello'],
        ], $listed['members'] ?? null);
    }

    #[Test]
    public function onlyWhoeverChangesPeopleListsWhomToAdd(): void
    {
        $editor = $this->member('editor@ire.events', SeededRole::Member);
        self::onEvent($editor, $this->owambe, EventRole::CanEdit);

        $this->as($editor, 'GET', '/api/events/' . $this->owambe . '/people/addable');

        self::assertSame(403, $this->statusCode());
    }

    #[Test]
    public function everyoneOnTheEventReadsWhoItsOwnersAndAdminsAre(): void
    {
        $this->member('julien@ire.events', SeededRole::Admin, 'Julien Moreau');
        $viewer = $this->member('ana@ire.events', SeededRole::Member, 'Ana Lima');
        self::onEvent($viewer, $this->owambe, EventRole::CanView);

        $read = $this->as($viewer, 'GET', '/api/events/' . $this->owambe . '/people');

        self::assertSame(200, $this->statusCode());
        self::assertSame(['Person', 'Julien Moreau'], $read['ownersAndAdmins'] ?? null);
    }

    #[Test]
    public function nobodyChangesOrRemovesTheirOwnEventRole(): void
    {
        $lead = $this->member('lead@ire.events', SeededRole::Member);
        $own = self::onEvent($lead, $this->owambe, EventRole::Lead)->getId()->toRfc4122();

        $this->as($lead, 'PATCH', '/api/events/' . $this->owambe . '/people/' . $own, ['role' => 'can_view']);
        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::OwnEventRole->type(), $this->last()['type'] ?? null);
        $this->as($lead, 'DELETE', '/api/events/' . $this->owambe . '/people/' . $own);
        self::assertSame(403, $this->statusCode());
        self::assertSame(EventRole::Lead, $this->personOf($lead, $this->owambe)?->getRole());
    }

    #[Test]
    public function onlyAnActiveMemberOfTheOrganisationIsAdded(): void
    {
        $stranger = $this->account('stranger@elsewhere.events');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $theirs = self::em()->getRepository(Membership::class)->findOneBy(['user' => $stranger->getId()]) ?? self::fail('no membership');

        $this->as($this->owner, 'POST', '/api/events/' . $this->owambe . '/people', ['membershipId' => $theirs->getId()->toRfc4122(), 'role' => 'lead']);

        self::assertSame(422, $this->statusCode());
        self::assertSame([], self::em()->getRepository(EventPerson::class)->findAll());
    }

    #[Test]
    public function aChangeAppliesOnTheNextRequestWithNobodySignedOut(): void
    {
        $member = $this->member('member@ire.events', SeededRole::Member);
        $person = self::onEvent($member, $this->owambe, EventRole::CanView)->getId()->toRfc4122();
        $token = $this->tokenFor($member);

        $this->rename($member, $this->owambe, 'Owambe at the lake', $token);
        self::assertSame(403, $this->statusCode());

        $this->as($this->owner, 'PATCH', '/api/events/' . $this->owambe . '/people/' . $person, ['role' => 'can_edit']);
        self::assertSame(200, $this->statusCode());

        $this->rename($member, $this->owambe, 'Owambe at the lake', $token);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function removalEndsEventRolesAndSuspensionKeepsThemForARestore(): void
    {
        $kept = $this->member('kept@ire.events', SeededRole::Member);
        $gone = $this->member('gone@ire.events', SeededRole::Member);
        self::onEvent($kept, $this->owambe, EventRole::CanEdit);
        $goneRole = self::onEvent($gone, $this->owambe, EventRole::CanEdit)->getId();

        $this->as($this->owner, 'POST', $this->path('members/' . $this->membershipOf($kept) . '/suspend'));
        self::assertSame(204, $this->statusCode());
        $this->as($kept, 'GET', '/api/events/' . $this->owambe);
        self::assertSame(404, $this->statusCode(), 'suspended');
        self::assertSame(EventRole::CanEdit, $this->personOf($kept, $this->owambe)?->getRole());

        $this->as($this->owner, 'POST', $this->path('members/' . $this->membershipOf($kept) . '/restore'));
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        $this->as($kept, 'GET', '/api/events/' . $this->owambe);
        self::assertSame(200, $this->statusCode(), 'restored, with the role it had');

        $this->as($this->owner, 'DELETE', $this->path('members/' . $this->membershipOf($gone)));
        self::assertSame(204, $this->statusCode());
        self::assertNull($this->personOf($gone, $this->owambe));
        $removed = self::em()->getRepository(AuditEntry::class)->findOneBy(['subjectId' => $goneRole, 'action' => 'event_person.removed']);
        self::assertSame(['active', 'left_or_removed'], $removed?->getChanges()['membershipStatus'] ?? null, 'the removal from the organisation is in the trail');
    }

    #[Test]
    public function anAdminMakesAdminsAndMembersButNeverAnOwner(): void
    {
        $admin = $this->member('admin@ire.events', SeededRole::Admin);
        $chidi = $this->member('chidi@ire.events', SeededRole::Member);

        foreach ([SeededRole::Admin, SeededRole::Member] as $seeded) {
            $this->as($admin, 'PATCH', $this->path('members/' . $this->membershipOf($chidi)), ['roleId' => $this->roleId($seeded)]);
            self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        }

        $this->as($admin, 'PATCH', $this->path('members/' . $this->membershipOf($chidi)), ['roleId' => $this->roleId(SeededRole::Owner)]);
        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::GrantNotHeld->type(), $this->last()['type'] ?? null);
    }

    /** An event's notices go to its Owners and Admins, and to the Members whose role on it reads it. */
    #[Test]
    public function anEventsAudienceIsWhoReachesIt(): void
    {
        $admin = $this->member('admin@ire.events', SeededRole::Admin);
        $onIt = $this->member('on@ire.events', SeededRole::Member);
        $elsewhere = $this->member('elsewhere@ire.events', SeededRole::Member);
        self::onEvent($onIt, $this->owambe, EventRole::CanCheckIn);
        self::onEvent($elsewhere, $this->naming, EventRole::Lead);

        $audience = Audience::membersOfEvent($this->organisation->getId(), Uuid::fromString($this->owambe), Permission::EventsRead);
        $resolved = self::service(MemberAudienceResolver::class)->resolve($audience, null, 50);

        $expected = Vec\map([$this->owner, $admin, $onIt], static fn (User $user): string => $user->getId()->toRfc4122());
        self::assertEqualsCanonicalizing($expected, Vec\map($resolved, static fn (Uuid $id): string => $id->toRfc4122()));
        self::assertNull(self::service(MemberAudienceResolver::class)->recipient($audience, $elsewhere->getId()));
        self::assertNotNull(self::service(MemberAudienceResolver::class)->recipient($audience, $onIt->getId()));
    }

    /** @return list<string> the names of the unfinished events listed */
    private function listed(User $who): array
    {
        $body = $this->as($who, 'GET', $this->path('events'));
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Vec\map(Type\vec(Type\shape(['name' => Type\string()], true))->coerce($body['events']), static fn (array $event): string => $event['name']);
    }

    private function rename(User $who, string $eventId, string $name, #[SensitiveParameter] ?string $token = null): void
    {
        $token ??= $this->tokenFor($who);
        $this->client->request('GET', '/api/events/' . $eventId, server: ['HTTP_AUTHORIZATION' => 'Bearer ' . $token]);
        $tag = (string) $this->client->getResponse()->headers->get('ETag');
        $this->client->request('PATCH', '/api/events/' . $eventId, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . $token,
            'HTTP_IF_MATCH' => '' === $tag ? '"0"' : $tag,
        ], content: Json\encode(['name' => $name]));
    }

    /** @return array<string, string> */
    private static function valid(): array
    {
        return ['name' => 'Owambe', 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN'];
    }

    private function create(string $name, string $startsAt): string
    {
        $body = $this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), 'name' => $name, 'startsAt' => $startsAt, 'endsAt' => $startsAt]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'])['id'];
    }

    private function account(string $address, string $name = 'Person'): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, SeededRole $seeded, string $name = 'Person'): User
    {
        $user = $this->account($address, $name);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $seeded]) ?? self::fail('no role');
        self::em()->persist(new Membership($organisation, $user, $role, MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        return $user;
    }

    private function membershipOf(User $user): string
    {
        $membership = self::em()->getRepository(Membership::class)->findOneBy(['user' => $user->getId(), 'organisation' => $this->organisation->getId()]) ?? self::fail('no membership');

        return $membership->getId()->toRfc4122();
    }

    private function personOf(User $user, string $eventId): ?EventPerson
    {
        self::em()->clear();

        return self::em()->getRepository(EventPerson::class)->findOneBy(['event' => $eventId, 'membership' => $this->membershipOf($user)]);
    }

    private function roleId(SeededRole $seeded): string
    {
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation->getId(), 'seededAs' => $seeded]) ?? self::fail('no role');

        return $role->getId()->toRfc4122();
    }

    private function path(string $rest): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/' . $rest;
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
