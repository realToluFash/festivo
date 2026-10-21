<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Event\EventCreator;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

final class EventsTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
    }

    #[Test]
    public function anOrganiserCreatesADraftServedInItsZone(): void
    {
        $body = $this->as($this->owner, 'POST', $this->path('events'), [
            'name' => '  Adé at 40  ',
            'startsAt' => '2026-11-14T16:00',
            'endsAt' => '2026-11-15T02:00',
            'timeZone' => 'Africa/Lagos',
            'currency' => 'NGN',
        ]);

        self::assertSame(201, $this->statusCode());
        $event = $this->event($body);
        self::assertSame('Adé at 40', $event['name']);
        self::assertSame('draft', $event['status']);
        self::assertSame('2026-11-14T16:00:00+01:00', $event['startsAt']);
        self::assertSame('2026-11-15T02:00:00+01:00', $event['endsAt']);
        self::assertSame('Africa/Lagos', $event['timeZone']);
        self::assertSame('NGN', $event['currency']);
        self::assertSame($this->organisation->getId()->toRfc4122(), $event['organisationId']);

        self::assertSame($event, $this->event($this->as($this->owner, 'GET', '/api/events/' . $event['id'])));
    }

    #[Test]
    public function theZoneAndCurrencyDefaultToTheOrganisations(): void
    {
        $event = $this->event($this->as($this->owner, 'POST', $this->path('events'), [
            'name' => 'Owambe',
            'startsAt' => '2026-11-14T16:00',
            'endsAt' => '2026-11-14T16:00',
        ]));

        self::assertSame(201, $this->statusCode());
        self::assertSame([$this->organisation->getTimezone(), $this->organisation->getCurrency()], [$event['timeZone'], $event['currency']]);
    }

    /** @return iterable<string, array{array<string, string>, string, string}> */
    public static function refusals(): iterable
    {
        yield 'a blank name' => [['name' => '   '], 'name', 'Give the event a name.'];
        yield 'a name past 120' => [['name' => Str\repeat('a', 121)], 'name', 'Use at most 120 characters for the name.'];
        yield 'no start' => [['startsAt' => ''], 'startsAt', 'Choose when the event starts.'];
        yield 'no end' => [['endsAt' => ''], 'endsAt', 'Choose when the event ends.'];
        yield 'an end before the start' => [['endsAt' => '2026-11-14T15:59'], 'endsAt', 'The end is before the start. Choose a later end.'];
        yield 'a start with an offset' => [['startsAt' => '2026-11-14T16:00+01:00'], 'startsAt', 'Enter a date and a time with no time zone offset.'];
        yield 'a start in UTC' => [['startsAt' => '2026-11-14T16:00:00Z'], 'startsAt', 'Enter a date and a time with no time zone offset.'];
        yield 'a date that does not exist' => [['startsAt' => '2026-02-30T16:00'], 'startsAt', 'Enter a date and a time with no time zone offset.'];
        yield 'a zone that is not IANA' => [['timeZone' => 'Lagos Time'], 'timeZone', 'Choose a time zone.'];
        yield 'a currency that is not ISO 4217' => [['currency' => 'NAI'], 'currency', 'Choose a currency.'];
    }

    /** @param array<string, string> $change */
    #[Test]
    #[DataProvider('refusals')]
    public function theServerRefusesWhatTheFormRefuses(array $change, string $field, string $message): void
    {
        $this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), ...$change]);

        self::assertSame(422, $this->statusCode());
        self::assertSame([$field => $message], $this->violations());
        self::assertSame([], $this->listed());
    }

    #[Test]
    public function everyProblemIsReportedAtOnce(): void
    {
        $this->as($this->owner, 'POST', $this->path('events'), ['name' => '', 'startsAt' => null, 'endsAt' => null]);

        self::assertSame(422, $this->statusCode());
        self::assertSame(['name', 'startsAt', 'endsAt'], Vec\keys($this->violations()));
    }

    #[Test]
    public function anEndEqualToTheStartIsAccepted(): void
    {
        $this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), 'endsAt' => '2026-11-14T16:00']);

        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function aSkippedTimeIsSavedLaterByTheGap(): void
    {
        $event = $this->event($this->as($this->owner, 'POST', $this->path('events'), [
            ...self::valid(),
            'startsAt' => '2026-03-29T02:30',
            'endsAt' => '2026-03-29T05:00',
            'timeZone' => 'Europe/Madrid',
        ]));

        self::assertSame('2026-03-29T03:30:00+02:00', $event['startsAt']);
        self::assertSame('2026-03-29T03:30:00+02:00', $this->event($this->as($this->owner, 'GET', '/api/events/' . $event['id']))['startsAt']);
    }

    #[Test]
    public function aRepeatedTimeTakesTheEarlierOffset(): void
    {
        $event = $this->event($this->as($this->owner, 'POST', $this->path('events'), [
            ...self::valid(),
            'startsAt' => '2026-10-25T02:30',
            'endsAt' => '2026-10-25T05:00',
            'timeZone' => 'Europe/Madrid',
        ]));

        self::assertSame('2026-10-25T02:30:00+02:00', $event['startsAt']);
    }

    /** The wall-clock time is the source: a stale UTC copy, as after a tzdata change, moves nothing that is served. */
    #[Test]
    public function aChangeInTheZonesRulesKeepsTheLocalTime(): void
    {
        $event = $this->event($this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), 'timeZone' => 'Europe/Madrid']));
        self::service(Connection::class)->executeStatement(
            "UPDATE events SET starts_at_utc = starts_at - INTERVAL '3 hours', ends_at_utc = ends_at - INTERVAL '3 hours' WHERE id = :id",
            ['id' => $event['id']],
        );
        self::em()->clear();

        $served = $this->event($this->as($this->owner, 'GET', '/api/events/' . $event['id']));

        self::assertSame('2026-11-14T16:00:00+01:00', $served['startsAt']);
        self::assertSame('2026-11-15T02:00:00+01:00', $served['endsAt']);
    }

    #[Test]
    public function theUtcColumnsAreTheInstantsOfTheLocalTimes(): void
    {
        $event = $this->event($this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), 'timeZone' => 'Europe/Madrid']));

        self::assertSame(
            ['starts_at' => '2026-11-14 16:00:00', 'starts_at_utc' => '2026-11-14 15:00:00', 'ends_at_utc' => '2026-11-15 01:00:00', 'closes_at' => '2026-11-15 01:00:00'],
            self::service(Connection::class)->fetchAssociative('SELECT starts_at, starts_at_utc, ends_at_utc, closes_at FROM events WHERE id = :id', ['id' => $event['id']]),
        );
    }

    #[Test]
    public function theListIsSoonestFirstThenByName(): void
    {
        $this->create('Later', '2026-12-01T10:00');
        $this->create('Bravo', '2026-11-14T16:00');
        $this->create('Alpha', '2026-11-14T16:00');
        $this->create('In Madrid, an hour earlier', '2026-11-14T16:00', 'Europe/Madrid');

        self::assertSame(['Alpha', 'Bravo', 'In Madrid, an hour earlier', 'Later'], $this->listed());
    }

    #[Test]
    public function twoEventsMayShareAName(): void
    {
        $this->create('Owambe', '2026-11-14T16:00');
        $this->create('Owambe', '2026-11-14T16:00');

        self::assertSame(['Owambe', 'Owambe'], $this->listed());
    }

    /** @return iterable<string, array{SeededRole, bool}> */
    public static function creators(): iterable
    {
        yield 'an administrator' => [SeededRole::Administrator, true];
        yield 'an event manager' => [SeededRole::EventManager, true];
        yield 'a coordinator' => [SeededRole::Coordinator, false];
        yield 'a read-only member' => [SeededRole::ReadOnly, false];
    }

    #[Test]
    #[DataProvider('creators')]
    public function onlyCreateEventsCreates(SeededRole $seeded, bool $creates): void
    {
        $member = $this->member('member@ire.events', $seeded);

        $this->as($member, 'POST', $this->path('events'), self::valid());

        self::assertSame($creates ? 201 : 403, $this->statusCode());

        if (!$creates) {
            self::assertSame(ErrorCode::PermissionRequired->type(), $this->last()['type'] ?? null);
        }
    }

    #[Test]
    public function everyMemberSeesAndOpensTheOrganisationsEvents(): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');
        $reader = $this->member('reader@ire.events', SeededRole::ReadOnly);

        self::assertSame(['Owambe'], Vec\map(Type\vec(Type\shape(['name' => Type\string()], true))->coerce($this->as($reader, 'GET', $this->path('events'))['events']), static fn (array $event): string => $event['name']));
        $this->as($reader, 'GET', '/api/events/' . $id);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function anotherOrganisationsEventReadsAsOneThatDoesNotExist(): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');
        $stranger = $this->account('stranger@elsewhere.events');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $this->as($stranger, 'GET', '/api/events/' . $id);
        $theirs = [$this->statusCode(), $this->last()];
        $this->as($stranger, 'GET', '/api/events/0193f5a8-0000-7000-8000-000000000000');
        $none = [$this->statusCode(), $this->last()];

        self::assertSame(404, $theirs[0]);
        self::assertSame(Vec\map([$theirs[1], $none[1]], static fn (array $body): array => [$body['code'] ?? null, $body['detail'] ?? null]), Vec\map([$none[1], $none[1]], static fn (array $body): array => [$body['code'] ?? null, $body['detail'] ?? null]));
        self::assertSame(404, $none[0]);

        $this->as($stranger, 'GET', $this->path('events'));
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function aCreateIsAuditedWithWhoAndWhen(): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');

        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => EventCreator::CREATED, 'subjectType' => 'Event']);

        self::assertInstanceOf(AuditEntry::class, $entry);
        self::assertSame($id, $entry->subjectId()->toRfc4122());
        self::assertSame($this->owner->getId()->toRfc4122(), $entry->actorId()?->toRfc4122());
        self::assertSame([null, $this->organisation->getId()->toRfc4122()], $entry->changes()['organisation'] ?? null);
        self::assertEqualsWithDelta(new DateTimeImmutable()->getTimestamp(), $entry->occurredAt()->getTimestamp(), 5);
    }

    /** @return array{name: string, startsAt: string, endsAt: string, timeZone: string, currency: string} */
    private static function valid(): array
    {
        return ['name' => 'Owambe', 'startsAt' => '2026-11-14T16:00', 'endsAt' => '2026-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN'];
    }

    private function create(string $name, string $startsAt, string $timeZone = 'Africa/Lagos'): string
    {
        $body = $this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), 'name' => $name, 'startsAt' => $startsAt, 'endsAt' => $startsAt, 'timeZone' => $timeZone]);
        self::assertSame(201, $this->statusCode());

        return $this->event($body)['id'];
    }

    /** @return list<string> */
    private function listed(): array
    {
        $body = $this->as($this->owner, 'GET', $this->path('events'));

        return Vec\map(Type\vec(Type\shape(['name' => Type\string()], true))->coerce($body['events']), static fn (array $event): string => $event['name']);
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array{id: string, organisationId: string, name: string, status: string, startsAt: string, endsAt: string, timeZone: string, currency: string, createdAt: string}
     */
    private function event(array $body): array
    {
        return Type\shape([
            'id' => Type\string(),
            'organisationId' => Type\string(),
            'name' => Type\string(),
            'status' => Type\string(),
            'startsAt' => Type\string(),
            'endsAt' => Type\string(),
            'timeZone' => Type\string(),
            'currency' => Type\string(),
            'createdAt' => Type\string(),
        ])->assert($body['event'] ?? null);
    }

    /** @return array<string, string> */
    private function violations(): array
    {
        $found = [];

        foreach (Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []) as $violation) {
            $found[$violation['propertyPath']] = $violation['message'];
        }

        return $found;
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, SeededRole $seeded): User
    {
        $user = $this->account($address);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        return $user;
    }

    private function path(string $rest): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/' . $rest;
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
