<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Address\Model\Address;
use App\Domain\Event\EventCreator;
use App\Domain\Event\EventEditor;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventType;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\ScriptedAddressProvider;
use App\Tests\Double\ScriptedEventAmounts;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Json;
use Psl\SecureRandom;
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
            'type' => 'birthday',
            'startsAt' => '2026-11-14T16:00',
            'endsAt' => '2026-11-15T02:00',
            'timeZone' => 'Africa/Lagos',
            'currency' => 'NGN',
        ]);

        self::assertSame(201, $this->statusCode());
        $event = $this->event($body);
        self::assertSame('Adé at 40', $event['name']);
        self::assertSame('birthday', $event['type']);
        self::assertSame('draft', $event['status']);
        self::assertSame('2026-11-14T16:00:00+01:00', $event['startsAt']);
        self::assertSame('2026-11-15T02:00:00+01:00', $event['endsAt']);
        self::assertSame('Africa/Lagos', $event['timeZone']);
        self::assertSame('NGN', $event['currency']);
        self::assertSame(2, $event['dayCount']);
        self::assertSame($this->organisation->getId()->toRfc4122(), $event['organisationId']);

        self::assertSame($event, $this->event($this->as($this->owner, 'GET', '/api/events/' . $event['id'])));
    }

    #[Test]
    public function theZoneAndCurrencyDefaultToTheOrganisations(): void
    {
        $event = $this->event($this->as($this->owner, 'POST', $this->path('events'), [
            'name' => 'Owambe',
            'type' => 'party',
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
        yield 'a type outside the list' => [['type' => 'burial'], 'type', 'Choose what kind of event it is.'];
        yield 'a type by its label' => [['type' => 'Wedding'], 'type', 'Choose what kind of event it is.'];
        yield 'a name past 120' => [['name' => Str\repeat('a', 121)], 'name', 'Shorten the name to 120 characters or fewer.'];
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
        self::assertSame(['name', 'type', 'startsAt', 'endsAt'], Vec\keys($this->violations()));
    }

    /** @return iterable<string, array{array<string, ?string>}> */
    public static function untyped(): iterable
    {
        yield 'type left out' => [[]];
        yield 'type null' => [['type' => null]];
        yield 'type blank' => [['type' => '']];
    }

    /** @param array<string, ?string> $type */
    #[Test]
    #[DataProvider('untyped')]
    public function aNewEventWithNoTypeIsRefusedUnderTheField(array $type): void
    {
        $body = Dict\filter_keys(self::valid(), static fn (string $field): bool => 'type' !== $field);
        $this->as($this->owner, 'POST', $this->path('events'), [...$body, ...$type]);

        self::assertSame(422, $this->statusCode());
        self::assertSame(['type' => 'Choose what kind of event it is.'], $this->violations());
        self::assertSame([], $this->listed());
    }

    #[Test]
    public function everyTypeOnTheListIsTaken(): void
    {
        foreach (EventType::cases() as $type) {
            $event = $this->event($this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), 'type' => $type->value]));

            self::assertSame($type->value, $event['type']);
        }
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
    public function everyResponseCountsTheDatesTheEventTouches(): void
    {
        $overnight = $this->event($this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), 'name' => 'Overnight', 'startsAt' => '2026-11-14T19:00', 'endsAt' => '2026-11-15T02:00']));
        $daytime = $this->event($this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), 'name' => 'Daytime', 'startsAt' => '2026-11-14T10:00', 'endsAt' => '2026-11-14T23:00']));

        self::assertSame([2, 1], [$overnight['dayCount'], $daytime['dayCount']]);
        self::assertSame(2, $this->event($this->as($this->owner, 'GET', '/api/events/' . $overnight['id']))['dayCount']);

        $listed = Type\vec(Type\shape(['name' => Type\string(), 'dayCount' => Type\int()], true))->coerce($this->as($this->owner, 'GET', $this->path('events'))['events']);
        self::assertSame(['Daytime' => 1, 'Overnight' => 2], Dict\from_entries(Vec\map($listed, static fn (array $event): array => [$event['name'], $event['dayCount']])));
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
        self::assertSame($id, $entry->getSubjectId()->toRfc4122());
        self::assertSame($this->owner->getId()->toRfc4122(), $entry->getActorId()?->toRfc4122());
        self::assertSame([null, $this->organisation->getId()->toRfc4122()], $entry->getChanges()['organisation'] ?? null);
        self::assertEqualsWithDelta(new DateTimeImmutable()->getTimestamp(), $entry->getOccurredAt()->getTimestamp(), 5);
    }

    #[Test]
    public function anOrganiserEditsWithTheTagTheyRead(): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');
        $read = $this->tagOf($id);

        $edited = $this->event($this->edit($id, ['name' => '  Adé at 40  ', 'startsAt' => '2026-11-14T18:00', 'endsAt' => '2026-11-15T01:00', 'currency' => 'GHS'], $read));

        self::assertSame(200, $this->statusCode());
        self::assertSame(['Adé at 40', '2026-11-14T18:00:00+01:00', '2026-11-15T01:00:00+01:00', 'Africa/Lagos', 'GHS'], [$edited['name'], $edited['startsAt'], $edited['endsAt'], $edited['timeZone'], $edited['currency']]);
        $tag = $this->tag();
        self::assertNotSame($read, $tag);
        self::assertSame($edited, $this->event($this->as($this->owner, 'GET', '/api/events/' . $id)));
        self::assertSame($tag, $this->tag());
    }

    #[Test]
    public function aFieldLeftOutKeepsItsValue(): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');

        $edited = $this->event($this->edit($id, ['name' => 'Owambe at night'], $this->tagOf($id)));

        self::assertSame(['Owambe at night', '2026-11-14T16:00:00+01:00', 'NGN'], [$edited['name'], $edited['startsAt'], $edited['currency']]);
    }

    /** @param array<string, string> $change */
    #[Test]
    #[DataProvider('refusals')]
    public function anEditIsRefusedWhatTheFormRefuses(array $change, string $field, string $message): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');
        $read = $this->tagOf($id);
        $before = $this->event($this->as($this->owner, 'GET', '/api/events/' . $id));

        $this->edit($id, $change, $read);

        self::assertSame(422, $this->statusCode());
        self::assertSame([$field => $message], $this->violations());
        self::assertSame($before, $this->event($this->as($this->owner, 'GET', '/api/events/' . $id)));
        self::assertSame($read, $this->tag());
    }

    #[Test]
    public function anEditChangesTheType(): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');

        $edited = $this->event($this->edit($id, ['type' => 'anniversary'], $this->tagOf($id)));

        self::assertSame(200, $this->statusCode());
        self::assertSame('anniversary', $edited['type']);
        self::assertSame('anniversary', $this->event($this->as($this->owner, 'GET', '/api/events/' . $id))['type']);
    }

    #[Test]
    public function anEditCannotTakeTheTypeAway(): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');
        $read = $this->tagOf($id);

        $this->edit($id, ['type' => null], $read);

        self::assertSame(422, $this->statusCode());
        self::assertSame(['type' => 'Choose what kind of event it is.'], $this->violations());
        self::assertSame('wedding', $this->event($this->as($this->owner, 'GET', '/api/events/' . $id))['type']);
        self::assertSame($read, $this->tag());
    }

    /** London's clocks go forward on 29 March 2026, Paris's the same night: both times stay as typed, each at its own offset. */
    #[Test]
    public function aNewZoneKeepsTheTimesAsTypedAcrossAChangeOfClocks(): void
    {
        $id = $this->event($this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), 'startsAt' => '2026-03-28T19:00', 'endsAt' => '2026-03-29T19:00', 'timeZone' => 'Europe/London']))['id'];

        $edited = $this->event($this->edit($id, ['timeZone' => 'Europe/Paris'], $this->tagOf($id)));

        self::assertSame(['2026-03-28T19:00:00+01:00', '2026-03-29T19:00:00+02:00', 'Europe/Paris'], [$edited['startsAt'], $edited['endsAt'], $edited['timeZone']]);
        self::assertSame(
            ['starts_at' => '2026-03-28 19:00:00', 'starts_at_utc' => '2026-03-28 18:00:00', 'ends_at_utc' => '2026-03-29 17:00:00'],
            self::service(Connection::class)->fetchAssociative('SELECT starts_at, starts_at_utc, ends_at_utc FROM events WHERE id = :id', ['id' => $id]),
        );
    }

    /** @return iterable<string, array{?string}> */
    public static function unnamedVersions(): iterable
    {
        yield 'no If-Match' => [null];
        yield 'If-Match: *' => ['*'];
    }

    #[Test]
    #[DataProvider('unnamedVersions')]
    public function anEditWithoutIfMatchIsRefusedAndSavesNothing(?string $ifMatch): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');

        $this->edit($id, ['name' => 'Changed'], $ifMatch);

        self::assertSame(428, $this->statusCode());
        self::assertSame(ErrorCode::PreconditionRequired->type(), $this->last()['type'] ?? null);
        self::assertSame('Send the version you are changing, as If-Match.', $this->last()['detail'] ?? null);
        self::assertSame('Owambe', $this->event($this->as($this->owner, 'GET', '/api/events/' . $id))['name']);
    }

    /** @return iterable<string, array{string}> */
    public static function staleTags(): iterable
    {
        yield 'the tag before a colleague saved' => ['stale'];
        yield 'the current tag, weak' => ['weak'];
    }

    #[Test]
    #[DataProvider('staleTags')]
    public function anEditFromAnOlderVersionIsRefusedAndKeepsTheColleaguesChange(string $which): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');
        $read = $this->tagOf($id);
        $this->edit($id, ['name' => 'Colleague’s name'], $read);
        $current = $this->tag();

        $this->edit($id, ['name' => 'Mine'], 'stale' === $which ? $read : 'W/' . $current);

        self::assertSame(412, $this->statusCode());
        self::assertSame(ErrorCode::PreconditionFailed->type(), $this->last()['type'] ?? null);
        self::assertSame('Somebody else changed this event since you opened it.', $this->last()['detail'] ?? null);
        self::assertSame('Colleague’s name', $this->event($this->as($this->owner, 'GET', '/api/events/' . $id))['name']);
    }

    /** @return iterable<string, array{string}> */
    public static function codings(): iterable
    {
        yield 'zstd' => ['zstd'];
        yield 'br' => ['br'];
        yield 'gzip' => ['gzip'];
    }

    #[Test]
    #[DataProvider('codings')]
    public function theTagOfACompressedReadStillMatches(string $coding): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');

        self::assertSame('"1"', $this->tagOf($id));

        $this->edit($id, ['name' => 'Renamed'], '"1-' . $coding . '"');

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame('Renamed', $this->event($this->last())['name']);
    }

    #[Test]
    public function aCurrencyNoLongerOfferedStaysThroughAnEditThatLeavesItOut(): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');
        self::service(Connection::class)->executeStatement("UPDATE events SET currency = 'ZWL' WHERE id = :id", ['id' => $id]);

        $this->edit($id, ['name' => 'Renamed'], $this->tagOf($id));

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['ZWL', 'Renamed'], [$this->event($this->last())['currency'], $this->event($this->last())['name']]);
    }

    #[Test]
    public function theCurrencyCannotChangeOnceAnAmountIsRecorded(): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');
        self::service(ScriptedEventAmounts::class)->record($id);

        $this->edit($id, ['currency' => 'GHS', 'name' => 'Renamed'], $this->tagOf($id));

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::EventCurrencyInUse->type(), $this->last()['type'] ?? null);
        self::assertSame('application/problem+json', $this->client->getResponse()->headers->get('Content-Type'));
        $kept = $this->event($this->as($this->owner, 'GET', '/api/events/' . $id));
        self::assertSame(['NGN', 'Owambe'], [$kept['currency'], $kept['name']]);

        $this->edit($id, ['currency' => 'NGN', 'name' => 'Renamed'], $this->tagOf($id));
        self::assertSame(200, $this->statusCode());
    }

    /** @return iterable<string, array{SeededRole, bool}> */
    public static function editors(): iterable
    {
        yield 'an administrator' => [SeededRole::Administrator, true];
        yield 'an event manager' => [SeededRole::EventManager, true];
        yield 'a coordinator' => [SeededRole::Coordinator, true];
        yield 'a read-only member' => [SeededRole::ReadOnly, false];
    }

    #[Test]
    #[DataProvider('editors')]
    public function onlyEventsManageEdits(SeededRole $seeded, bool $edits): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');
        $tag = $this->tagOf($id);
        $member = $this->member('member@ire.events', $seeded);

        $this->as($member, 'PATCH', '/api/events/' . $id, ['name' => 'Theirs'], $tag);

        self::assertSame($edits ? 200 : 403, $this->statusCode());

        if (!$edits) {
            self::assertSame(ErrorCode::PermissionRequired->type(), $this->last()['type'] ?? null);
        }
    }

    #[Test]
    public function anotherOrganisationsEventCannotBeEdited(): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');
        $tag = $this->tagOf($id);
        $stranger = $this->account('stranger@elsewhere.events');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $this->as($stranger, 'PATCH', '/api/events/' . $id, ['name' => 'Theirs'], $tag);

        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function anEditIsAuditedWithWhatChangedFromWhatToWhat(): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');

        $this->edit($id, ['name' => 'Owambe', 'endsAt' => '2026-11-14T23:00'], $this->tagOf($id));

        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => EventEditor::UPDATED, 'subjectType' => 'Event']);
        self::assertInstanceOf(AuditEntry::class, $entry);
        self::assertSame($id, $entry->getSubjectId()->toRfc4122());
        self::assertSame($this->owner->getId()->toRfc4122(), $entry->getActorId()?->toRfc4122());
        self::assertSame(['endsAt' => ['2026-11-14T16:00:00+01:00', '2026-11-14T23:00:00+01:00']], $entry->getChanges());
        self::assertEqualsWithDelta(new DateTimeImmutable()->getTimestamp(), $entry->getOccurredAt()->getTimestamp(), 5);
    }

    #[Test]
    public function anEditThatChangesNothingRecordsNothing(): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');
        $read = $this->tagOf($id);

        $this->edit($id, ['name' => 'Owambe', 'timeZone' => 'Africa/Lagos'], $read);

        self::assertSame(200, $this->statusCode());
        self::assertSame($read, $this->tag());
        self::assertNull(self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => EventEditor::UPDATED]));
    }

    #[Test]
    public function aPickedAddressIsSavedWithItsPartsAsTheClientsReadIt(): void
    {
        $id = $this->pick();

        $body = $this->as($this->owner, 'POST', $this->path('events'), [
            ...self::valid(),
            'venue' => ['name' => '  The Civic Centre  ', 'address' => 'Ozumba Mbadiwe', 'addressId' => $id],
        ]);

        self::assertSame(201, $this->statusCode(), Json\encode($body));
        self::assertSame(self::picked(), $this->event($body)['venue']);
        self::assertSame(self::picked(), $this->event($this->as($this->owner, 'GET', '/api/events/' . $this->event($body)['id']))['venue']);
    }

    #[Test]
    public function aTypedAddressIsSavedAsTyped(): void
    {
        $body = $this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), 'venue' => ['address' => ' 12 Bode Thomas Street, Surulere ']]);

        self::assertSame(201, $this->statusCode());
        self::assertSame(['name' => null, 'address' => self::typed('12 Bode Thomas Street, Surulere')], $this->event($body)['venue']);
    }

    #[Test]
    public function anAddressTheLookupNeverResolvedIsSavedAsTypedWithoutAskingTheProvider(): void
    {
        $id = $this->publishPicked();

        $body = $this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), 'venue' => ['name' => null, 'address' => 'Ozumba Mbadiwe Avenue', 'addressId' => $id]]);

        self::assertSame(201, $this->statusCode());
        self::assertSame(['name' => null, 'address' => self::typed('Ozumba Mbadiwe Avenue')], $this->event($body)['venue']);
    }

    #[Test]
    public function anEventWithNoVenueServesNull(): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');

        self::assertNull($this->event($this->as($this->owner, 'GET', '/api/events/' . $id))['venue']);
    }

    /** @return iterable<string, array{array<string, string>, string, string}> */
    public static function venueRefusals(): iterable
    {
        yield 'a venue name past 120' => [['name' => Str\repeat('a', 121)], 'venueName', 'Shorten the venue name to 120 characters or fewer.'];
        yield 'an address past 300' => [['address' => Str\repeat('a', 301)], 'venueAddress', 'Shorten the address to 300 characters or fewer.'];
    }

    /** @param array<string, string> $venue */
    #[Test]
    #[DataProvider('venueRefusals')]
    public function aVenueTooLongIsRefusedOnCreateAndOnEdit(array $venue, string $field, string $message): void
    {
        $this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), 'venue' => $venue]);

        self::assertSame(422, $this->statusCode());
        self::assertSame([$field => $message], $this->violations());

        $id = $this->create('Owambe', '2026-11-14T16:00');
        $this->edit($id, ['venue' => $venue], $this->tagOf($id));

        self::assertSame(422, $this->statusCode());
        self::assertSame([$field => $message], $this->violations());
    }

    #[Test]
    public function aVenueNameOf120AfterTrimmingIsAccepted(): void
    {
        $body = $this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), 'venue' => ['name' => '  ' . Str\repeat('a', 120) . '  ']]);

        self::assertSame(201, $this->statusCode());
        self::assertSame(['name' => Str\repeat('a', 120), 'address' => null], $this->event($body)['venue']);
    }

    /** @return iterable<string, array{array<string, string>|null}> */
    public static function clearings(): iterable
    {
        yield 'both fields blank' => [['name' => '  ', 'address' => '']];
        yield 'null' => [null];
    }

    /** @param array<string, string>|null $venue */
    #[Test]
    #[DataProvider('clearings')]
    public function clearingBothFieldsRemovesTheVenue(?array $venue): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');
        $this->edit($id, ['venue' => ['name' => 'The Civic Centre', 'address' => 'Victoria Island']], $this->tagOf($id));

        $this->edit($id, ['venue' => $venue], $this->tagOf($id));

        self::assertSame(200, $this->statusCode());
        self::assertNull($this->event($this->last())['venue']);
    }

    #[Test]
    public function anAddressSentBackUnchangedKeepsItsParts(): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');
        $this->edit($id, ['venue' => ['address' => 'Ozumba', 'addressId' => $this->pick()]], $this->tagOf($id));

        $this->edit($id, ['venue' => ['name' => 'The Civic Centre', 'address' => self::picked()['address']['formatted']]], $this->tagOf($id));

        self::assertSame(200, $this->statusCode());
        self::assertSame(self::picked(), $this->event($this->last())['venue']);

        $this->edit($id, ['venue' => ['name' => 'The Civic Centre', 'address' => 'Victoria Island']], $this->tagOf($id));
        self::assertSame(['name' => 'The Civic Centre', 'address' => self::typed('Victoria Island')], $this->event($this->last())['venue']);
    }

    #[Test]
    public function anEditLeavingTheVenueOutKeepsIt(): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');
        $this->edit($id, ['venue' => ['name' => 'The Civic Centre']], $this->tagOf($id));

        $this->edit($id, ['name' => 'Renamed'], $this->tagOf($id));

        self::assertSame(['name' => 'The Civic Centre', 'address' => null], $this->event($this->last())['venue']);
    }

    #[Test]
    public function aVenueIsAuditedAsPartOfTheEventsEdit(): void
    {
        $id = $this->create('Owambe', '2026-11-14T16:00');

        $this->edit($id, ['venue' => ['name' => 'The Civic Centre', 'address' => 'Ozumba', 'addressId' => $this->pick()]], $this->tagOf($id));

        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => EventEditor::UPDATED, 'subjectType' => 'Event']);
        self::assertInstanceOf(AuditEntry::class, $entry);
        self::assertSame([
            'venueName' => [null, 'The Civic Centre'],
            'venueAddress' => [null, 'Ozumba Mbadiwe Avenue, Victoria Island, Lagos, Nigeria'],
            'venueCountryCode' => [null, 'NG'],
            'venueCoordinates' => [null, [6.4316, 3.4246]],
        ], $entry->getChanges());
    }

    #[Test]
    public function aVenueOnANewEventIsInItsCreateEntry(): void
    {
        $this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), 'venue' => ['address' => 'Victoria Island']]);

        $entry = self::em()->getRepository(AuditEntry::class)->findOneBy(['action' => EventCreator::CREATED, 'subjectType' => 'Event']);
        self::assertInstanceOf(AuditEntry::class, $entry);
        self::assertSame([null, 'Victoria Island'], $entry->getChanges()['venueAddress'] ?? null);
        self::assertArrayNotHasKey('venueName', $entry->getChanges());
    }

    /**
     * The venue the clients' tests read too (packages/api-client), so the two sides cannot drift.
     *
     * @return array{name: string, address: array{formatted: string, ...}, ...}
     */
    private static function picked(): array
    {
        return Type\shape([
            'name' => Type\string(),
            'address' => Type\shape(['formatted' => Type\string()], true),
        ], true)->coerce(Json\decode((string) \file_get_contents(__DIR__ . '/../Fixtures/Venue/picked-venue.json')));
    }

    /** @return array<string, string|null> */
    private static function typed(string $formatted): array
    {
        return ['formatted' => $formatted, 'line1' => null, 'line2' => null, 'city' => null, 'region' => null, 'postalCode' => null, 'countryCode' => null, 'latitude' => null, 'longitude' => null];
    }

    /** Picked as the clients pick it: the save reads the address their lookup resolved. */
    private function pick(): string
    {
        $id = $this->publishPicked();
        $this->as($this->owner, 'GET', '/api/addresses/' . $id);
        self::assertSame(200, $this->statusCode());

        return $id;
    }

    /** A fresh id each time: the lookup's cache outlives a test. */
    private function publishPicked(): string
    {
        $address = Type\shape([
            'formatted' => Type\string(),
            'line1' => Type\string(),
            'line2' => Type\string(),
            'city' => Type\string(),
            'region' => Type\string(),
            'postalCode' => Type\string(),
            'countryCode' => Type\string(),
            'latitude' => Type\float(),
            'longitude' => Type\float(),
        ])->coerce(self::picked()['address']);
        $id = 'node:' . SecureRandom\int(1, \PHP_INT_MAX);

        self::service(ScriptedAddressProvider::class)->publish($id, new Address(...$address));

        return $id;
    }

    /** @return array{name: string, type: string, startsAt: string, endsAt: string, timeZone: string, currency: string} */
    private static function valid(): array
    {
        return ['name' => 'Owambe', 'type' => 'wedding', 'startsAt' => '2026-11-14T16:00', 'endsAt' => '2026-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN'];
    }

    private function create(string $name, string $startsAt, string $timeZone = 'Africa/Lagos'): string
    {
        $body = $this->as($this->owner, 'POST', $this->path('events'), [...self::valid(), 'name' => $name, 'startsAt' => $startsAt, 'endsAt' => $startsAt, 'timeZone' => $timeZone]);
        self::assertSame(201, $this->statusCode());

        return $this->event($body)['id'];
    }

    private function tagOf(string $id): string
    {
        $this->as($this->owner, 'GET', '/api/events/' . $id);

        return $this->tag();
    }

    private function tag(): string
    {
        return (string) $this->client->getResponse()->headers->get('ETag');
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array<string, mixed>
     */
    private function edit(string $id, array $body, ?string $ifMatch): array
    {
        return $this->as($this->owner, 'PATCH', '/api/events/' . $id, $body, $ifMatch);
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
     * @return array{id: string, organisationId: string, name: string, type: string, status: string, startsAt: string, endsAt: string, timeZone: string, dayCount: int, currency: string, venue: mixed, createdAt: string}
     */
    private function event(array $body): array
    {
        return Type\shape([
            'id' => Type\string(),
            'organisationId' => Type\string(),
            'name' => Type\string(),
            'type' => Type\string(),
            'status' => Type\string(),
            'startsAt' => Type\string(),
            'endsAt' => Type\string(),
            'timeZone' => Type\string(),
            'dayCount' => Type\int(),
            'currency' => Type\string(),
            'venue' => Type\mixed(),
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
    private function as(User $user, string $method, string $path, ?array $body = null, ?string $ifMatch = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
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
