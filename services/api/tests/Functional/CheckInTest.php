<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\Arrival\Arrivals;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mercure\Update;

/** Check-in at the door (sc-1454): arrivals, undo, walk-ins, the count, who may, and an arrived guest staying on the list. */
final class CheckInTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string DEVICE = 'door-phone-0123456789';

    private const string ADAEZE = 'Chief Mrs Adaeze Okonkwo-Williams';

    /** 16:00 in Lagos is 15:00 UTC, so the door opens at 13:00 UTC. */
    private const string BEFORE_OPEN = '2030-11-14T12:59:00+00:00';

    private const string OPEN = '2030-11-14T18:42:00+00:00';

    private const string ENDED = '2030-11-15T02:30:00+00:00';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-10-17T13:20:00+00:00'));
        $this->owner = $this->account('owner@ire.events', 'Funmi Adeyemi');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live("Amara & Tobi's wedding");
    }

    #[Test]
    public function arrivedRecordsTheMomentAndWhoAndChangesNothingElseOnTheGuest(): void
    {
        $guest = $this->add(self::ADAEZE, ['Obi Okonkwo']);
        $this->reply($this->token($guest), 'maybe');
        $before = $this->details($guest);
        self::mockTime(new DateTimeImmutable(self::OPEN));

        $read = $this->arrive($guest);

        self::assertSame(200, $this->statusCode(), Json\encode($read));
        $row = $this->row($read, $guest);
        self::assertSame(['at' => '2030-11-14T19:42:00+01:00', 'by' => 'Funmi Adeyemi'], $row['arrival']);
        self::assertSame('maybe', $row['reply']);
        self::assertNull(Type\shape(['companions' => Type\vec(Type\shape(['arrival' => Type\mixed()], true))], true)->coerce($row)['companions'][0]['arrival']);
        $after = $this->details($guest);
        unset($before['arrival'], $after['arrival']);
        self::assertSame($before, $after);
    }

    #[Test]
    public function aCompanionArrivesOnTheirOwnAndArrivingTheirHostArrivesNobodyElse(): void
    {
        $guest = $this->add(self::ADAEZE, ['Obi Okonkwo', null]);
        self::mockTime(new DateTimeImmutable(self::OPEN));
        $companions = $this->companionIds($guest);

        $read = $this->arrive($companions[1]);

        $row = $this->row($read, $guest);
        self::assertNull($row['arrival']);
        $arrivals = Vec\map(Type\shape(['companions' => Type\vec(Type\shape(['arrival' => Type\mixed()], true))], true)->coerce($row)['companions'], static fn (array $one): bool => null !== $one['arrival']);
        self::assertSame([false, true], $arrivals);
    }

    #[Test]
    public function aSecondArrivedKeepsTheFirstArrivalAndIsNoError(): void
    {
        $guest = $this->add(self::ADAEZE);
        self::mockTime(new DateTimeImmutable(self::OPEN));
        $this->arrive($guest);
        self::mockTime(new DateTimeImmutable('2030-11-14T18:50:00+00:00'));

        $read = $this->arrive($guest);

        self::assertSame(200, $this->statusCode());
        self::assertSame('2030-11-14T19:42:00+01:00', Type\shape(['at' => Type\string()], true)->coerce($this->row($read, $guest)['arrival'])['at']);
        self::assertSame(1, $this->audited(Arrivals::ARRIVED));
    }

    #[Test]
    public function undoClearsTheArrivalAndEachIsInTheEventsAuditWithTheDevice(): void
    {
        $guest = $this->add(self::ADAEZE);
        self::mockTime(new DateTimeImmutable(self::OPEN));
        $this->arrive($guest);

        $read = $this->as($this->owner, 'DELETE', $this->checkIn() . '/arrivals/' . $guest);

        self::assertSame(200, $this->statusCode(), Json\encode($read));
        self::assertNull($this->row($read, $guest)['arrival']);
        $rows = self::em()->getConnection()->fetchAllAssociative("SELECT action, subject_type, subject_id, actor_id, changes FROM audit_entries WHERE action LIKE 'guest.arriv%' ORDER BY id");
        self::assertSame([Arrivals::ARRIVED, Arrivals::ARRIVAL_UNDONE], Vec\map($rows, static fn (array $row): mixed => $row['action']));

        foreach ($rows as $row) {
            self::assertSame(['Event', $this->eventId, $this->owner->getId()->toRfc4122()], [$row['subject_type'], $row['subject_id'], $row['actor_id']]);
            self::assertStringContainsString(self::DEVICE, Type\string()->coerce($row['changes']));
            self::assertStringNotContainsString('Adaeze', Type\string()->coerce($row['changes']));
        }
    }

    #[Test]
    public function beforeTheDoorOpensTheListReadsAndNothingIsRecorded(): void
    {
        $guest = $this->add(self::ADAEZE);
        self::mockTime(new DateTimeImmutable(self::BEFORE_OPEN));

        $read = $this->as($this->owner, 'GET', $this->checkIn());

        self::assertSame(['state' => 'before_open', 'opensAt' => '2030-11-14T14:00:00+01:00', 'timeZone' => 'Africa/Lagos'], $read['checkIn'] ?? null);
        $this->arrive($guest);
        self::assertSame([409, 'check_in_closed'], [$this->statusCode(), $this->code()]);
        $this->walkIn('Kemi Olatunji');
        self::assertSame(409, $this->statusCode());
    }

    #[Test]
    public function onceTheEventHasEndedTheArrivalsReadOnly(): void
    {
        $guest = $this->add(self::ADAEZE);
        self::mockTime(new DateTimeImmutable(self::OPEN));
        $this->arrive($guest);
        self::mockTime(new DateTimeImmutable(self::ENDED));

        $read = $this->as($this->owner, 'GET', $this->checkIn());

        self::assertSame('ended', Type\shape(['state' => Type\string()], true)->coerce($read['checkIn'] ?? null)['state']);
        self::assertNotNull($this->row($read, $guest)['arrival']);
        $this->as($this->owner, 'DELETE', $this->checkIn() . '/arrivals/' . $guest);
        self::assertSame(409, $this->statusCode());
    }

    #[Test]
    public function theDoorsListCarriesNamesRepliesAndArrivalsAndNoContactNeedOrGroup(): void
    {
        $this->as($this->owner, 'POST', $this->guests(), ['fullName' => self::ADAEZE, 'email' => 'adaeze@example.com', 'needs' => ['allergies' => ['peanuts'], 'note' => 'Step-free'], 'group' => ['name' => 'Family']]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        $read = $this->as($this->owner, 'GET', $this->checkIn());

        $row = Type\shape(['guests' => Type\vec(Type\dict(Type\string(), Type\mixed()))], true)->coerce($read)['guests'][0];
        self::assertSame(['id', 'fullName', 'reply', 'repliedAt', 'code', 'walkIn', 'arrival', 'companions'], Vec\keys($row));
        self::assertStringNotContainsString('adaeze@example.com', Json\encode($read));
        self::assertStringNotContainsString('Family', Json\encode($read));
    }

    #[Test]
    public function aWalkInIsAddedArrivedWithANameAndNothingElseAndCountsOnceInEachFigure(): void
    {
        $guest = $this->add(self::ADAEZE);
        $this->reply($this->token($guest), 'coming');
        self::mockTime(new DateTimeImmutable(self::OPEN));

        $read = $this->walkIn('  Kemi Olatunji ');

        self::assertSame(201, $this->statusCode(), Json\encode($read));
        $id = Type\shape(['walkIn' => Type\shape(['id' => Type\string()])], true)->coerce($read)['walkIn']['id'];
        $row = $this->row($read, $id);
        self::assertSame(['Kemi Olatunji', true, 'noReply', []], [$row['fullName'], $row['walkIn'], $row['reply'], $row['companions']]);
        self::assertNotNull($row['arrival']);
        self::assertSame(['attended' => 1, 'expected' => 2], $read['count'] ?? null);
        $details = $this->details($id);
        self::assertSame([true, null, null], [$details['walkIn'], $details['email'], $details['invitation']]);
        $this->as($this->owner, 'GET', $this->guests() . '/' . $id . '/link');
        self::assertNotSame(200, $this->statusCode());
    }

    #[Test]
    public function withNobodyComingTheCountIsWhoeverArrived(): void
    {
        $guest = $this->add(self::ADAEZE);
        self::mockTime(new DateTimeImmutable(self::OPEN));

        $read = $this->arrive($guest);

        self::assertSame(['attended' => 1, 'expected' => 1], $read['count'] ?? null);
        $counts = $this->counts();
        self::assertSame([0, 1, 1], [$counts['accepted'], $counts['attended'], $counts['expected']]);
    }

    #[Test]
    public function aWalkInWhoseNameIsOnTheListAsksFirstAndCreatesNothing(): void
    {
        $guest = $this->add(self::ADAEZE);
        self::mockTime(new DateTimeImmutable(self::OPEN));

        $this->walkIn('chief mrs adaeze okonkwo-williams');

        self::assertSame(409, $this->statusCode());
        self::assertSame(['guest_already_listed', self::ADAEZE . ' is already on the list'], [$this->code(), $this->last()['detail'] ?? null]);
        self::assertSame(['id' => $guest, 'fullName' => self::ADAEZE, 'hostId' => null], $this->last()['guest'] ?? null);
        self::assertSame(1, $this->people());

        $this->as($this->owner, 'POST', $this->checkIn() . '/walk-ins', ['fullName' => self::ADAEZE, 'allowDuplicate' => true]);
        self::assertSame([201, 2], [$this->statusCode(), $this->people()]);
    }

    #[Test]
    public function aWalkInsNameIsRequiredAndAtMost200CharactersInTheWordsTheScreenUses(): void
    {
        self::mockTime(new DateTimeImmutable(self::OPEN));

        $this->walkIn('   ');
        self::assertSame([422, 'Enter their full name.'], [$this->statusCode(), $this->violation()]);

        $this->walkIn(Str\repeat('a', 201));
        self::assertSame([422, 'Shorten the name to 200 characters or fewer.'], [$this->statusCode(), $this->violation()]);
        self::assertSame(0, $this->people());
    }

    #[Test]
    public function canCheckGuestsInAndCanEditMayAndCanViewIsRefused403(): void
    {
        $guest = $this->add(self::ADAEZE);
        $door = $this->member('door@ire.events', SeededRole::Member, EventRole::CanCheckIn);
        $editor = $this->member('editor@ire.events', SeededRole::Member, EventRole::CanEdit);
        $viewer = $this->member('viewer@ire.events', SeededRole::Member, EventRole::CanView);
        self::mockTime(new DateTimeImmutable(self::OPEN));

        $this->as($door, 'POST', $this->checkIn() . '/arrivals', ['guestId' => $guest]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->as($editor, 'DELETE', $this->checkIn() . '/arrivals/' . $guest);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->as($viewer, 'POST', $this->checkIn() . '/arrivals', ['guestId' => $guest]);
        self::assertSame(403, $this->statusCode());
        $this->as($viewer, 'POST', $this->checkIn() . '/walk-ins', ['fullName' => 'Kemi Olatunji']);
        self::assertSame(403, $this->statusCode());
        $this->as($viewer, 'GET', $this->checkIn());
        self::assertSame(403, $this->statusCode());
    }

    #[Test]
    public function aDoorPersonStillSeesNoGuestContactDetails(): void
    {
        $this->as($this->owner, 'POST', $this->guests(), ['fullName' => self::ADAEZE, 'email' => 'adaeze@example.com']);
        $door = $this->member('door@ire.events', SeededRole::Member, EventRole::CanCheckIn);

        $list = $this->as($door, 'GET', $this->guests());

        self::assertSame(200, $this->statusCode());
        self::assertStringNotContainsString('adaeze@example.com', Json\encode($list));
    }

    #[Test]
    public function theLiveChannelSaysOnlyThatTheListChangedSoAnEndedGrantLearnsNoName(): void
    {
        $guest = $this->add(self::ADAEZE);
        $door = $this->member('door@ire.events', SeededRole::Member, EventRole::CanCheckIn);
        self::mockTime(new DateTimeImmutable(self::OPEN));
        $this->as($door, 'GET', $this->checkIn());
        self::assertSame(200, $this->statusCode());
        $token = Type\shape(['token' => Type\string()], true)->coerce($this->as($door, 'POST', $this->checkIn() . '/subscriptions'))['token'];
        $claims = Type\shape(['mercure' => Type\shape(['subscribe' => Type\vec(Type\string())], true)], true)->coerce(Json\decode(\base64_decode(Str\split($token, '.')[1], true) ?: '{}'));
        self::assertSame(['events/' . $this->eventId . '/check-in'], $claims['mercure']['subscribe']);
        self::em()->getConnection()->executeStatement('DELETE FROM event_people WHERE event_id = :event', ['event' => $this->eventId]);

        $hub = self::service(RecordingHub::class);
        $hub->published = [];

        $this->arrive($guest);
        $this->as($this->owner, 'DELETE', $this->checkIn() . '/arrivals/' . $guest);
        $this->walkIn('Kemi Olatunji');

        self::assertSame(Vec\fill(3, [['events/' . $this->eventId . '/check-in'], '[]']), Vec\map($hub->published, static fn (Update $update): array => [$update->getTopics(), $update->getData()]));
        $this->as($door, 'GET', $this->checkIn());
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function anArrivedGuestOrOneWithAnArrivedCompanionStaysOnTheListUntilTheArrivalIsUndone(): void
    {
        $guest = $this->add(self::ADAEZE, ['Obi Okonkwo']);
        $other = $this->add('Bisi Adewale', ['Tunde Adewale']);
        self::mockTime(new DateTimeImmutable(self::OPEN));
        $this->arrive($guest);
        $this->arrive($this->companionIds($other)[0]);

        $this->as($this->owner, 'DELETE', $this->guests() . '/' . $guest);
        self::assertSame([409, 'guest_arrived', 'arrived'], [$this->statusCode(), $this->code(), $this->last()['why'] ?? null]);
        self::assertSame(self::ADAEZE . ' has arrived, so they stay on the list.', $this->last()['detail'] ?? null);

        $this->as($this->owner, 'DELETE', $this->guests() . '/' . $other);
        self::assertSame([409, 'companionArrived'], [$this->statusCode(), $this->last()['why'] ?? null]);
        self::assertSame('A companion of Bisi Adewale has arrived, so they stay on the list.', $this->last()['detail'] ?? null);

        $this->as($this->owner, 'DELETE', $this->checkIn() . '/arrivals/' . $guest);
        $this->as($this->owner, 'DELETE', $this->guests() . '/' . $guest);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function anEditThatTakesOffAnArrivedCompanionIsRefusedAndOneNotArrivedGoes(): void
    {
        $guest = $this->add('Bisi Adewale', ['Tunde Adewale', 'Kemi Adewale']);
        [$tunde, $kemi] = $this->companionIds($guest);
        self::mockTime(new DateTimeImmutable(self::OPEN));
        $this->arrive($tunde);

        $this->as($this->owner, 'PUT', $this->guests() . '/' . $guest, ['fullName' => 'Bisi Adewale', 'companions' => [['id' => $kemi, 'fullName' => 'Kemi Adewale']]], '"1"');
        self::assertSame([409, 'guest_arrived', 'companionArrived'], [$this->statusCode(), $this->code(), $this->last()['why'] ?? null]);
        self::assertSame('A companion of Bisi Adewale has arrived, so they stay on the list.', $this->last()['detail'] ?? null);
        self::assertSame([$tunde, $kemi], $this->companionIds($guest));
        self::assertSame(1, $this->counts()['attended'] ?? null);

        $this->as($this->owner, 'PUT', $this->guests() . '/' . $guest, ['fullName' => 'Bisi Adewale', 'companions' => [['id' => $tunde, 'fullName' => 'Tunde Adewale']]], '"1"');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([$tunde], $this->companionIds($guest));
    }

    #[Test]
    public function removingManyLeavesTheArrivedAndRemovesTheRestAndRefusesWhenEveryoneStays(): void
    {
        $guest = $this->add(self::ADAEZE);
        $other = $this->add('Bisi Adewale', ['Tunde Adewale']);
        $leaving = $this->add('Kemi Olatunji');
        self::mockTime(new DateTimeImmutable(self::OPEN));
        $this->arrive($guest);
        $this->arrive($this->companionIds($other)[0]);

        $removed = $this->as($this->owner, 'POST', $this->guests() . '/removals', ['guestIds' => [$guest, $other, $leaving]]);

        self::assertSame(200, $this->statusCode(), Json\encode($removed));
        self::assertSame([1, 0], [$removed['guests'] ?? null, $removed['gone'] ?? null]);
        self::assertSame([
            ['id' => $guest, 'fullName' => self::ADAEZE, 'why' => 'arrived'],
            ['id' => $other, 'fullName' => 'Bisi Adewale', 'why' => 'companionArrived'],
        ], $removed['stayed'] ?? null);
        self::assertSame([self::ADAEZE, 'Bisi Adewale'], $this->names());

        $this->as($this->owner, 'POST', $this->guests() . '/removals', ['guestIds' => [$guest, $other]]);
        self::assertSame([409, 'guest_arrived'], [$this->statusCode(), $this->code()]);
        self::assertSame([self::ADAEZE, 'Bisi Adewale'], $this->names());
    }

    #[Test]
    public function aComingGuestsPageShowsTheirCodeAndTheDoorsListHoldsOnlyItsDigest(): void
    {
        $guest = $this->add(self::ADAEZE, ['Obi Okonkwo']);
        $token = $this->token($guest);
        $this->reply($token, 'maybe');
        self::assertNull($this->page($token)['checkInCode']);

        $this->reply($token, 'coming');

        $shown = Type\shape(['code' => Type\string(), 'qrSvg' => Type\string()])->coerce($this->page($token)['checkInCode']);
        self::assertMatchesRegularExpression('/^[A-Za-z0-9_-]{43}$/', $shown['code']);
        self::assertNotSame($token, $shown['code']);
        self::assertStringContainsString('<svg', $shown['qrSvg']);
        $door = Json\encode($this->as($this->owner, 'GET', $this->checkIn()));
        self::assertStringNotContainsString($shown['code'], $door);
        self::assertSame(\hash('sha256', $shown['code']), $this->row($this->last(), $guest)['code']);
        $this->reply($token, 'notComing');
        self::assertNull($this->page($token)['checkInCode']);
    }

    #[Test]
    public function anArrivalRecordedOfflineCountsOnceAtTheEarlierOfTwoDevicesTimes(): void
    {
        $guest = $this->add(self::ADAEZE);
        self::mockTime(new DateTimeImmutable(self::OPEN));
        $this->arrive($guest);

        $read = $this->arrive($guest, '2030-11-14T19:30:00+01:00');

        self::assertSame(200, $this->statusCode(), Json\encode($read));
        self::assertSame('2030-11-14T19:30:00+01:00', Type\shape(['at' => Type\string()], true)->coerce($this->row($read, $guest)['arrival'])['at']);
        $read = $this->arrive($guest, '2030-11-14T19:35:00+01:00');
        self::assertSame('2030-11-14T19:30:00+01:00', Type\shape(['at' => Type\string()], true)->coerce($this->row($read, $guest)['arrival'])['at']);
        self::assertSame(1, Type\shape(['count' => Type\shape(['attended' => Type\int()], true)], true)->coerce($read)['count']['attended']);
    }

    #[Test]
    public function anArrivalRecordedOfflineBeforeTheDoorOpenedIsRefusedAndOneFromTheFutureIsNow(): void
    {
        $guest = $this->add(self::ADAEZE);
        self::mockTime(new DateTimeImmutable(self::OPEN));

        $this->arrive($guest, '2030-11-14T13:00:00+01:00');
        self::assertSame([409, 'check_in_closed'], [$this->statusCode(), $this->code()]);
        $read = $this->arrive($guest, '2030-11-14T23:00:00+01:00');

        self::assertSame('2030-11-14T19:42:00+01:00', Type\shape(['at' => Type\string()], true)->coerce($this->row($read, $guest)['arrival'])['at']);
        $this->arrive($guest, 'not a time');
        self::assertSame(422, $this->statusCode());
    }

    /** @return array<string, mixed> */
    private function arrive(string $person, ?string $at = null): array
    {
        $this->client->setServerParameter('HTTP_X_DEVICE_ID', self::DEVICE);

        return $this->as($this->owner, 'POST', $this->checkIn() . '/arrivals', ['guestId' => $person, ...null === $at ? [] : ['arrivedAt' => $at]]);
    }

    /** @return array<string, mixed> */
    private function page(#[SensitiveParameter] string $token): array
    {
        $this->client->request('POST', '/api/guest-links/page', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode(['token' => $token]));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function walkIn(string $name): array
    {
        return $this->as($this->owner, 'POST', $this->checkIn() . '/walk-ins', ['fullName' => $name]);
    }

    /**
     * @param array<string, mixed> $read
     *
     * @return array<string, mixed>
     */
    private function row(array $read, string $id): array
    {
        $guests = Type\shape(['guests' => Type\vec(Type\dict(Type\string(), Type\mixed()))], true)->coerce($read)['guests'];

        foreach ($guests as $guest) {
            if ($guest['id'] === $id) {
                return $guest;
            }
        }

        self::fail('not on the door\'s list: ' . $id);
    }

    /** @return list<string> */
    private function companionIds(string $guest): array
    {
        $details = Type\shape(['companions' => Type\vec(Type\shape(['id' => Type\string()], true))], true)->coerce($this->details($guest));

        return Vec\map($details['companions'], static fn (array $one): string => $one['id']);
    }

    private function audited(string $action): int
    {
        return Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM audit_entries WHERE action = :action', ['action' => $action]));
    }

    private function code(): ?string
    {
        return Str\after(Type\string()->coerce($this->last()['type'] ?? ''), '/errors/');
    }

    private function violation(): ?string
    {
        $violations = Type\shape(['violations' => Type\vec(Type\shape(['message' => Type\string()], true))], true)->coerce($this->last());

        return $violations['violations'][0]['message'] ?? null;
    }

    private function checkIn(): string
    {
        return '/api/events/' . $this->eventId . '/check-in';
    }

    /** @param list<?string> $companions */
    private function add(string $name, array $companions = []): string
    {
        $body = $this->as($this->owner, 'POST', $this->guests(), [
            'fullName' => $name,
            'companions' => Vec\map($companions, static fn (?string $companion): array => ['fullName' => $companion]),
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['guest'] ?? null)['id'];
    }

    /** @return array<string, mixed> */
    private function details(string $guest): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce($this->as($this->owner, 'GET', $this->guests() . '/' . $guest)['guest'] ?? null);
    }

    /** @return list<string> */
    private function names(): array
    {
        $list = Type\shape(['guests' => Type\vec(Type\shape(['fullName' => Type\string()], true))], true)->coerce($this->as($this->owner, 'GET', $this->guests()));

        return Vec\map($list['guests'], static fn (array $row): string => $row['fullName']);
    }

    /** @return array<string, mixed> */
    private function counts(): array
    {
        $body = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/headcount');

        return Type\shape(['headcount' => Type\shape(['counts' => Type\dict(Type\string(), Type\mixed())], true)], true)->coerce($body)['headcount']['counts'];
    }

    private function people(): int
    {
        return Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT COUNT(*) FROM guests'));
    }

    private function token(string $guest): string
    {
        $body = $this->as($this->owner, 'GET', $this->guests() . '/' . $guest . '/link');
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Str\after(Type\string()->coerce($body['url'] ?? null), '/i/') ?? self::fail('no token');
    }

    private function reply(#[SensitiveParameter] string $token, string $answer): void
    {
        $this->client->request('POST', '/api/guest-links/reply', server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode(['token' => $token, 'answer' => $answer]));
    }

    private function live(string $name): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', ['name' => $name, 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
        self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as($this->owner, 'POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function guests(): string
    {
        return '/api/events/' . $this->eventId . '/guests';
    }

    private function account(string $address, string $name = 'Person'): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, SeededRole $seeded, ?EventRole $on): User
    {
        $user = $this->account($address);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        if (null !== $on) {
            self::onEvent($user, $this->eventId, $on);
        }

        return $user;
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
            'HTTP_ACCEPT_LANGUAGE' => 'en',
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
