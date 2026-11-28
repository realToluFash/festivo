<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Billing\HardLimits;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Organisation\Plan\PlanChanger;
use App\Domain\Organisation\RequestLink\LinkRequester;
use App\Domain\Service\ServiceSteps;
use App\Domain\Service\ServingTables;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\Invitation;
use App\Entity\Membership;
use App\Entity\MenuCourse;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\SeatAssignment;
use App\Entity\SeatingPlan;
use App\Entity\SeatingSection;
use App\Entity\SeatingTable;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\InvitationStatus;
use App\Enum\MembershipStatus;
use App\Enum\Plan;
use App\Enum\SectionColour;
use App\Enum\SeededRole;
use App\Enum\TableShape;
use App\Locale\NameNormaliser;
use App\Tests\ApiTestCase;
use App\Tests\Double\ScriptedHardLimits;
use App\Tests\Traits\InvitesPeople;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

final class HardLimitsTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use InvitesPeople;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string OPEN = '2030-11-14T18:42:00+00:00';

    private User $owner;

    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-10-17T13:20:00+00:00'));
        $this->owner = self::service(UserRegistrar::class)->register('owner@ire.events', 'Funmi Adeyemi', self::PASSWORD)->user;
        self::onboard($this->owner, withOrganisation: false);
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        self::service(ScriptedHardLimits::class)->enforce();
    }

    #[Test]
    public function aGuestWhoseCompanionsWouldPassTheFreePlansPeopleIsRefusedAndNobodyIsAdded(): void
    {
        $event = $this->event();
        $this->seed($event, 98);

        $this->add($event, 'Bisi Okoro', ['Tunde Okoro', null]);

        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::PlanLimitReached->type(), $this->last()['type'] ?? null);
        self::assertSame(['limit' => 'guests_per_event', 'plan' => 'free', 'used' => 98, 'allowed' => 100, 'adding' => 3], $this->members('limit', 'plan', 'used', 'allowed', 'adding'));
        self::assertSame('Not added. Your Free plan allows 100 people per event.', $this->last()['detail'] ?? null);
        self::assertSame(98, $this->people($event));

        $this->add($event, 'Bisi Okoro', ['Tunde Okoro']);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(100, $this->people($event));
    }

    #[Test]
    public function aPickFromContactsPastTheFreePlansPeopleIsRefusedWholeAndTheRoomSaysWhatIsLeft(): void
    {
        $event = $this->event();
        $this->seed($event, 96);

        self::assertSame(['plan' => 'free', 'allowed' => 100, 'people' => 96], $this->as('GET', '/api/events/' . $event . '/guests/room'));

        $this->as('POST', '/api/events/' . $event . '/guests/from-contacts', ['guests' => [
            ['fullName' => 'Bisi Okoro', 'companions' => 2],
            ['fullName' => 'Kofi Mensah'],
            ['fullName' => 'Ama Owusu'],
        ]]);

        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::PlanLimitReached->type(), $this->last()['type'] ?? null);
        self::assertSame(['limit' => 'guests_per_event', 'used' => 96, 'allowed' => 100, 'adding' => 5], $this->members('limit', 'used', 'allowed', 'adding'));
        self::assertSame(96, $this->people($event));

        $this->as('POST', '/api/events/' . $event . '/guests/from-contacts', ['guests' => [
            ['fullName' => 'Bisi Okoro', 'companions' => 1],
            ['fullName' => 'Kofi Mensah'],
        ]]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(99, $this->people($event));
    }

    #[Test]
    public function aCompanionPlaceGivenPastTheLimitIsRefusedAndOneSwappedForAnotherIsNot(): void
    {
        $event = $this->event();
        $this->seed($event, 98);
        $guest = Type\string()->coerce($this->add($event, 'Bisi Okoro', ['Tunde Okoro'])['id'] ?? null);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        $this->as('PUT', '/api/events/' . $event . '/guests/' . $guest, ['fullName' => 'Bisi Okoro', 'companions' => [['fullName' => 'Tunde Okoro'], ['fullName' => 'Ngozi Okoro']]], '"1"');

        self::assertSame(403, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(ErrorCode::PlanLimitReached->type(), $this->last()['type'] ?? null);
        self::assertSame(['used' => 100, 'adding' => 1], $this->members('used', 'adding'));
        self::assertSame(100, $this->people($event));

        $this->as('PUT', '/api/events/' . $event . '/guests/' . $guest, ['fullName' => 'Bisi Okoro', 'companions' => [['fullName' => 'Ngozi Okoro']]], '"1"');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(100, $this->people($event));
    }

    #[Test]
    public function anEnterpriseEventTakesAnyNumberUpToTheCeilingWhichNoPlanLifts(): void
    {
        self::service(PlanChanger::class)->change($this->organisation, Plan::Enterprise, 'Ada at Soirely', 'A test reaches the ceiling.');
        self::em()->flush();
        $event = $this->event();
        $this->seed($event, HardLimits::EVENT_CAPACITY - 2);

        $this->add($event, 'Bisi Okoro', ['Tunde Okoro', 'Ngozi Okoro']);

        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::EventCapacityReached->type(), $this->last()['type'] ?? null);
        self::assertSame(['ceiling' => 10_000, 'onEvent' => 9_998, 'adding' => 3], $this->members('ceiling', 'onEvent', 'adding'));
        self::assertArrayNotHasKey('plan', $this->last());
        self::assertSame('Not added. An event can have up to 10,000 people.', $this->last()['detail'] ?? null);

        $this->add($event, 'Bisi Okoro', ['Tunde Okoro']);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(10_000, $this->people($event));
    }

    #[Test]
    public function aCopyWhoseGuestListWouldPassThePlanIsRefusedWholeAndNothingIsCreated(): void
    {
        $original = $this->event();
        $this->seed($original, 142);
        $events = $this->events();

        $this->as('POST', '/api/events/' . $original . '/duplicate', ['startsAt' => '2030-12-14T16:00', 'copyGuests' => true]);

        self::assertSame(403, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(ErrorCode::PlanLimitReached->type(), $this->last()['type'] ?? null);
        self::assertSame(['limit' => 'guests_per_event', 'used' => 0, 'allowed' => 100, 'adding' => 142], $this->members('limit', 'used', 'allowed', 'adding'));
        self::assertSame('Not created. The guest list would bring 142 people, and your plan has room for 100 in a new event.', $this->last()['detail'] ?? null);
        self::assertSame($events, $this->events());

        $this->as('POST', '/api/events/' . $original . '/duplicate', ['startsAt' => '2030-12-14T16:00', 'copyGuests' => false]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function aCopyOfAnEventAtTheCeilingBringsEveryoneAndHoldsOnlyAPageOfThemAtATime(): void
    {
        self::service(PlanChanger::class)->change($this->organisation, Plan::Enterprise, 'Ada at Soirely', 'A test copies an event at the ceiling.');
        self::em()->flush();
        $original = $this->event();
        $this->seed($original, HardLimits::EVENT_CAPACITY - 1_000);
        self::service(Connection::class)->executeStatement(
            "INSERT INTO guests (id, event_id, host_id, full_name, name_key, position, created_at, updated_at) SELECT gen_random_uuid(), event_id, id, 'Plus one of ' || full_name, 'plus one of ' || name_key, 1, NOW(), NOW() FROM (SELECT * FROM guests WHERE event_id = :event ORDER BY id DESC LIMIT 1000) AS hosts",
            ['event' => $original],
        );
        self::em()->clear();

        $this->as('POST', '/api/events/' . $original . '/duplicate', ['startsAt' => '2030-12-14T16:00', 'copyGuests' => true]);

        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(9_000, $this->last()['guestsCopied'] ?? null);
        $copy = Type\shape(['id' => Type\string()], true)->coerce($this->last()['event'] ?? null)['id'];
        self::assertSame(10_000, $this->people($copy));
        self::assertSame(1_000, Type\int()->coerce(self::service(Connection::class)->fetchOne("SELECT COUNT(*) FROM guests c JOIN guests h ON h.id = c.host_id WHERE c.event_id = :copy AND h.event_id = :copy AND c.full_name = 'Plus one of ' || h.full_name", ['copy' => $copy])));
        self::assertLessThan(1_000, Iter\count(self::em()->getUnitOfWork()->getIdentityMap()[Guest::class] ?? []));
    }

    #[Test]
    public function aLiveEventOverTheLimitStillSendsTakesRepliesWalkInsAndArrivalsAndRunsServiceAndAsksNoLimit(): void
    {
        $event = $this->event(live: true);
        $guest = Type\string()->coerce($this->add($event, 'Bisi Okoro')['id'] ?? null);
        $this->seed($event, 120);
        $limits = self::service(ScriptedHardLimits::class);
        $asked = $limits->consulted;
        $token = Type\string()->coerce($this->as('GET', '/api/events/' . $event . '/guests/' . $guest . '/link')['url'] ?? null);
        $this->client->request('POST', '/api/guest-links/reply', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['token' => Str\after($token, '/i/') ?? self::fail('no token'), 'answer' => 'coming']));
        self::assertLessThan(300, $this->statusCode(), Json\encode($this->last()));
        self::mockTime(new DateTimeImmutable(self::OPEN));

        $this->as('POST', '/api/events/' . $event . '/check-in/walk-ins', ['fullName' => 'Kemi Olatunji']);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $this->client->setServerParameter('HTTP_X_DEVICE_ID', 'door-phone-0123456789');
        $this->as('POST', '/api/events/' . $event . '/check-in/arrivals', ['guestId' => $guest]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->as('POST', '/api/events/' . $event . '/messages', ['audience' => 'all', 'message' => 'The doors are open.']);
        self::assertSame(202, $this->statusCode(), Json\encode($this->last()));
        $course = $this->fireAt($event, $guest);
        $this->client->setServerParameter('HTTP_IDEMPOTENCY_KEY', Uuid::v4()->toRfc4122());
        $this->as('PUT', '/api/events/' . $event . '/service/course/' . $course . '/items', ['item' => 'plantain', 'state' => 'preparing', 'readyIn' => 10, 'expected' => ['item' => 'ready']]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame(122, $this->people($event));
        self::assertSame($asked, $limits->consulted, 'something past creation asked a hard limit');
    }

    #[Test]
    public function anInvitationIsRefusedOnceMembersAndPendingInvitationsFillTheSeatsAndAResendIsNot(): void
    {
        $this->invite('ada@example.com');
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $this->invite('ben@example.com');
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        $this->invite('cleo@example.com');

        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::PlanLimitReached->type(), $this->last()['type'] ?? null);
        self::assertSame(['limit' => 'team_seats', 'plan' => 'free', 'used' => 3, 'allowed' => 3], $this->members('limit', 'plan', 'used', 'allowed'));
        self::assertSame('Not sent. Your Free plan allows 3 team seats.', $this->last()['detail'] ?? null);
        self::assertNull(self::em()->getRepository(Invitation::class)->findOneBy(['email' => 'cleo@example.com']));

        $this->invite('ben@example.com');
        self::assertSame(201, $this->statusCode(), 'a resend takes no second seat');
    }

    #[Test]
    public function aResendOfALapsedInvitationAsksForTheSeatItNoLongerHolds(): void
    {
        $this->invite('ada@example.com');
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        self::service(Connection::class)->executeStatement("UPDATE invitations SET expires_at = '2026-09-17 13:20:00' WHERE email = 'ada@example.com'");
        $this->invite('ben@example.com');
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $this->invite('dan@example.com');
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        $this->invite('ada@example.com');

        self::assertSame(403, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['limit' => 'team_seats', 'used' => 3, 'allowed' => 3], $this->members('limit', 'used', 'allowed'));
        self::em()->clear();
        self::assertSame('2026-09-17', self::em()->getRepository(Invitation::class)->findOneBy(['email' => 'ada@example.com'])?->getExpiresAt()->format('Y-m-d'));
    }

    #[Test]
    public function acceptingIsRefusedWhenItWouldTakeTheSeatsPastThePlanAndTheInvitationIsKept(): void
    {
        self::service(ScriptedHardLimits::class)->consulted = [];
        $limits = self::service(ScriptedHardLimits::class);
        [$invitation] = self::invitationTo('kemi@example.com', $this->organisation);
        self::invitationTo('ada@example.com', $this->organisation);
        self::invitationTo('ben@example.com', $this->organisation);
        $kemi = self::inviter('kemi@example.com', 'Kemi Lawal');

        $this->as('POST', '/api/invitations/' . $invitation->getId()->toRfc4122() . '/accept', null, null, $kemi);

        self::assertSame(403, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(ErrorCode::PlanLimitReached->type(), $this->last()['type'] ?? null);
        self::assertSame(['limit' => 'team_seats', 'used' => 4, 'allowed' => 3, 'organisation' => 'Ìrè Events'], $this->members('limit', 'used', 'allowed', 'organisation'));
        self::assertSame('Every team seat at Ìrè Events is in use.', $this->last()['detail'] ?? null);
        self::em()->clear();
        self::assertSame(InvitationStatus::Pending, self::em()->find(Invitation::class, $invitation->getId())?->getStatus());
        self::assertSame(1, $limits->asked('requireSeatToAccept'));
    }

    #[Test]
    public function approvingAJoinRequestIsRefusedOnceTheSeatsAreFullAndTheRequestWaitsAsItWas(): void
    {
        $kemi = self::service(UserRegistrar::class)->register('kemi@ire.events', 'Kemi Lawal', self::PASSWORD)->user;
        self::onboard($kemi, withOrganisation: false);
        self::service(LinkRequester::class)->ask($kemi, $this->organisation, null);
        self::em()->flush();
        $this->invite('ada@example.com');
        $this->invite('ben@example.com');
        self::assertSame(201, $this->statusCode(), 'a waiting request holds no seat');
        $request = self::em()->getRepository(Membership::class)->findOneBy(['user' => $kemi, 'organisation' => $this->organisation]) ?? self::fail('no request');
        [$role, $lapses] = [$request->getRole()->getId(), $request->getRequestExpiresAt()];
        self::getMailerMessages();

        $this->as('POST', Str\format('/api/orgs/%s/members/%s/approve', $this->organisation->getId()->toRfc4122(), $request->getId()->toRfc4122()), ['roleId' => $this->role(SeededRole::Member)->getId()->toRfc4122()]);

        self::assertSame(403, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(ErrorCode::PlanLimitReached->type(), $this->last()['type'] ?? null);
        self::assertSame(['limit' => 'team_seats', 'plan' => 'free', 'used' => 3, 'allowed' => 3], $this->members('limit', 'plan', 'used', 'allowed'));
        self::assertSame('Not approved. Your Free plan allows 3 team seats.', $this->last()['detail'] ?? null);
        self::em()->clear();
        $kept = self::em()->find(Membership::class, $request->getId()) ?? self::fail('the request went');
        self::assertSame(MembershipStatus::PendingApproval, $kept->getStatus());
        self::assertTrue($role->equals($kept->getRole()->getId()));
        self::assertEquals($lapses, $kept->getRequestExpiresAt());
        self::assertEmailCount(0);
    }

    private function event(bool $live = false): string
    {
        $body = $this->as('POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => "Amara & Tobi's wedding", 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];

        if ($live) {
            self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
            $this->as('POST', '/api/events/' . $id . '/make-live');
            self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        }

        return $id;
    }

    /** Seats the guest at a table and fires a course there, as the kitchen starts service; returns the course. */
    private function fireAt(string $eventId, string $guestId): string
    {
        $event = self::em()->find(Event::class, $eventId) ?? self::fail('no event');
        $guest = self::em()->find(Guest::class, $guestId) ?? self::fail('no guest');
        $course = new MenuCourse($event, 'Main', null, 0);
        $course->listOwnItems(['Plantain']);
        $plan = new SeatingPlan($event, null, 2000, 2000, null);
        $section = new SeatingSection($plan, 'Section A', NameNormaliser::key('Section A'), SectionColour::Blue, null);
        $table = new SeatingTable($plan, 'Table 1', NameNormaliser::key('Table 1'), TableShape::Round, 100, 100, null);
        $table->setSection($section);
        Iter\apply([$course, $plan, $section, $table, new SeatAssignment($guest, $table, 1)], static fn (object $row) => self::em()->persist($row));
        self::em()->flush();

        $serving = self::service(ServingTables::class)->find($event, 'table:' . $table->getId()->toRfc4122()) ?? self::fail('no table');
        self::service(ServiceSteps::class)->fire($course, $serving, self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no owner'));

        return $course->getId()->toRfc4122();
    }

    private function seed(string $event, int $people): void
    {
        self::service(Connection::class)->executeStatement(
            "INSERT INTO guests (id, event_id, full_name, name_key, position, created_at, updated_at, link_token, check_in_code) SELECT gen_random_uuid(), :event, 'Seeded ' || n, 'seeded ' || n, 0, NOW(), NOW(), LEFT(MD5(RANDOM()::TEXT) || MD5(RANDOM()::TEXT), 43), LEFT(MD5(RANDOM()::TEXT) || MD5(RANDOM()::TEXT), 43) FROM generate_series(1, :people) AS n",
            ['event' => $event, 'people' => $people],
        );
    }

    private function people(string $event): int
    {
        return Type\int()->coerce(self::service(Connection::class)->fetchOne('SELECT COUNT(*) FROM guests WHERE event_id = :event AND removed_at IS NULL', ['event' => $event]));
    }

    private function events(): int
    {
        return self::em()->getRepository(Event::class)->count(['organisation' => $this->organisation]);
    }

    /**
     * @param list<?string> $companions
     *
     * @return array<string, mixed>
     */
    private function add(string $event, string $name, array $companions = []): array
    {
        $body = $this->as('POST', '/api/events/' . $event . '/guests', ['fullName' => $name, 'companions' => Vec\map($companions, static fn (?string $companion): array => ['fullName' => $companion])]);

        return Type\dict(Type\string(), Type\mixed())->coerce($body['guest'] ?? $body);
    }

    private function invite(string $email): void
    {
        $role = $this->role(SeededRole::Member);
        $this->as('POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/members/invite', ['email' => $email, 'roleId' => $role->getId()->toRfc4122()]);
    }

    private function role(SeededRole $as): Role
    {
        return Type\instance_of(Role::class)->coerce(self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $as]));
    }

    /** @return array<string, mixed> */
    private function members(string ...$names): array
    {
        $last = $this->last();
        $found = [];

        foreach ($names as $name) {
            $found[$name] = $last[$name] ?? null;
        }

        return $found;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(string $method, string $path, ?array $body = null, ?string $ifMatch = null, ?User $user = null): array
    {
        $who = self::em()->find(User::class, ($user ?? $this->owner)->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT_LANGUAGE' => 'en',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            ...null === $ifMatch ? [] : ['HTTP_IF_MATCH' => $ifMatch],
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
