<?php

declare(strict_types=1);

namespace App\Tests\Functional;

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
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mercure\Update;

/** Each person's own seat on the door's list (sc-60684): every kind of seat, No seat yet, no line before anybody is seated, Share tables changing nothing, the bare signal after a seating change, and who may read it. */
final class CheckInSeatsTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string ADAEZE = 'Chief Mrs Adaeze Okonkwo-Williams';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2030-11-01T10:00:00+01:00'));
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent();
    }

    #[Test]
    public function withNoPlanOrAPlanNobodyIsSeatedOnTheListCarriesNoSeat(): void
    {
        $ada = $this->guest(self::ADAEZE, ['Obi Okonkwo']);

        $door = $this->door();
        self::assertFalse($door['seated'] ?? null, 'no plan');
        self::assertNull($this->row($door, $ada)['seat']);

        $this->startPlan();
        $this->addTable();
        $door = $this->door();

        self::assertFalse($door['seated'] ?? null, 'a plan with nobody seated');
        self::assertNull($this->row($door, $ada)['seat']);
        self::assertSame([null], Vec\map($this->companions($ada), static fn (array $one): mixed => $one['seat']));
    }

    #[Test]
    public function eachKindOfSeatReadsByTheHostsOwnNamesWithItsSectionOrNone(): void
    {
        $this->startPlan();
        $hall = $this->addSection('Main hall');
        $table = $this->addTable();
        $this->patch('tables', $table, ['name' => 'Table 4', 'sectionId' => $hall]);
        $row = Type\string()->coerce($this->as($this->owner, 'POST', $this->plan() . '/rows')['rowId'] ?? null);
        $this->patch('rows', $row, ['label' => 'C', 'seats' => 14]);
        $single = Type\string()->coerce($this->as($this->owner, 'POST', $this->plan() . '/seats')['seatId'] ?? null);
        $this->patch('singleSeats', $single, ['name' => 'Seat 12']);
        $ada = $this->guest(self::ADAEZE);
        $bisi = $this->guest('Bisi Adewale');
        $kemi = $this->guest('Kemi Olatunji');
        $this->seat($ada, 'table', $table);
        $this->seat($bisi, 'row', $row, 14);
        $this->seat($kemi, 'seat', $single);

        $door = $this->door();

        self::assertTrue($door['seated'] ?? null);
        self::assertSame(['kind' => 'table', 'name' => 'Table 4', 'section' => 'Main hall'], $this->row($door, $ada)['seat']);
        self::assertSame(['kind' => 'row', 'name' => 'C', 'seat' => 14, 'section' => null], $this->row($door, $bisi)['seat']);
        self::assertSame(['kind' => 'seat', 'name' => 'Seat 12', 'section' => null], $this->row($door, $kemi)['seat']);
    }

    #[Test]
    public function eachCompanionCarriesTheirOwnSeatAndAnUnseatedOneNone(): void
    {
        $this->startPlan();
        $four = $this->addTable();
        $six = $this->addTable();
        $ada = $this->guest(self::ADAEZE, ['Obi Okonkwo', null, 'Tunde Obi']);
        $this->seat($ada, 'table', $four);
        $companions = $this->companions($ada);
        $this->seat(Type\string()->coerce($companions[0]['id']), 'table', $four);
        $this->seat(Type\string()->coerce($companions[1]['id']), 'table', $six);

        $seats = Vec\map($this->companions($ada), static fn (array $one): mixed => $one['seat']);

        self::assertSame([
            ['kind' => 'table', 'name' => 'Table 1', 'section' => null],
            ['kind' => 'table', 'name' => 'Table 2', 'section' => null],
            null,
        ], $seats, 'a companion at their host\'s table repeats it; Tunde, unseated, has none');
    }

    #[Test]
    public function aSeatFreedByNotComingOrByUnseatingReadsNone(): void
    {
        $this->startPlan();
        $table = $this->addTable();
        $ada = $this->guest(self::ADAEZE);
        $bisi = $this->guest('Bisi Adewale');
        $kemi = $this->guest('Kemi Olatunji');
        $this->seat($ada, 'table', $table);
        $this->seat($bisi, 'table', $table);
        $this->seat($kemi, 'table', $table);

        $this->reply($bisi, 'notComing');
        $this->as($this->owner, 'POST', $this->plan() . '/guests/unseat', ['guestIds' => [$kemi]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $door = $this->door();

        self::assertTrue($door['seated'] ?? null);
        self::assertNull($this->row($door, $bisi)['seat']);
        self::assertNull($this->row($door, $kemi)['seat']);
        self::assertNotNull($this->row($door, $ada)['seat']);
    }

    #[Test]
    public function aWalkInHasNoSeatOnceSomebodyIs(): void
    {
        $this->startPlan();
        $this->seat($this->guest(self::ADAEZE), 'table', $this->addTable());
        self::mockTime(new DateTimeImmutable('2030-11-14T19:00:00+01:00'));

        $added = $this->as($this->owner, 'POST', $this->checkIn() . '/walk-ins', ['fullName' => 'Kofi Asante']);

        self::assertSame(201, $this->statusCode(), Json\encode($added));
        $walkIn = Type\shape(['id' => Type\string()], true)->coerce($added['walkIn'] ?? null)['id'];
        self::assertNull($this->row($added, $walkIn)['seat']);
        self::assertTrue($added['seated'] ?? null);
    }

    #[Test]
    public function sharingTablesWithGuestsChangesNothingAtTheDoor(): void
    {
        $this->startPlan();
        $ada = $this->guest(self::ADAEZE);
        $this->seat($ada, 'table', $this->addTable());
        $before = $this->door();

        $this->as($this->owner, 'PATCH', $this->plan() . '/sharing', ['shared' => true]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame($before, $this->door());
        self::assertSame(['kind' => 'table', 'name' => 'Table 1', 'section' => null], $this->row($before, $ada)['seat']);
    }

    #[Test]
    public function aSeatChangeOrARenameTellsEveryOpenDoorToReadAgainWithNothingInTheSignal(): void
    {
        $this->startPlan();
        $hall = $this->addSection('Main hall');
        $table = $this->addTable();
        $this->patch('tables', $table, ['sectionId' => $hall]);
        $ada = $this->guest(self::ADAEZE);
        $hub = self::service(RecordingHub::class);

        foreach ([
            'seated' => fn () => $this->seat($ada, 'table', $table),
            'table renamed' => fn () => $this->patch('tables', $table, ['name' => 'Table 4']),
            'section renamed' => fn () => $this->patch('sections', $hall, ['name' => 'Garden']),
            'unseated' => fn () => $this->as($this->owner, 'POST', $this->plan() . '/guests/unseat', ['guestIds' => [$ada]]),
        ] as $change => $make) {
            $hub->published = [];
            $make();
            $signals = Vec\filter($hub->published, fn (Update $update): bool => $update->getTopics() === ['events/' . $this->eventId . '/check-in']);
            self::assertCount(1, $signals, $change);
            self::assertSame('[]', Iter\first($signals)?->getData(), $change . ': the signal carries no name and no seat');

            if ('section renamed' === $change) {
                self::assertSame(['kind' => 'table', 'name' => 'Table 4', 'section' => 'Garden'], $this->row($this->door(), $ada)['seat']);
            }
        }

        self::assertNull($this->row($this->door(), $ada)['seat']);
    }

    #[Test]
    public function aSeatCarriesNothingElseFromThePlan(): void
    {
        $this->startPlan();
        $table = $this->addTable();
        $ada = $this->guest(self::ADAEZE, ['Obi Okonkwo'], withNeeds: true);
        $this->seat($this->guest('Bisi Adewale'), 'table', $table);
        $this->seat($ada, 'table', $table);
        $companion = Type\string()->coerce($this->companions($ada)[0]['id']);
        $this->seat($companion, 'table', $table);
        $door = $this->door();

        foreach ([$this->row($door, $ada)['seat'], $this->companions($ada)[0]['seat']] as $seat) {
            self::assertSame(['kind', 'name', 'section'], Vec\keys(Type\dict(Type\string(), Type\mixed())->coerce($seat)));
        }

        self::assertStringNotContainsString('Step-free', Json\encode($door));
        self::assertStringNotContainsString('peanuts', Json\encode($door));
        self::assertStringNotContainsString('Family', Json\encode($door));
    }

    #[Test]
    public function canCheckGuestsInReadsTheSeatCanViewIsRefusedAndAnEndedGrantOrAnotherOrganisationIsNotFound(): void
    {
        $this->startPlan();
        $ada = $this->guest(self::ADAEZE);
        $this->seat($ada, 'table', $this->addTable());
        $door = $this->member('door@ire.events', EventRole::CanCheckIn);
        $viewer = $this->member('viewer@ire.events', EventRole::CanView);
        $stranger = $this->account('stranger@elsewhere.events');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $read = $this->as($door, 'GET', $this->checkIn());
        self::assertSame(200, $this->statusCode(), Json\encode($read));
        self::assertSame(['kind' => 'table', 'name' => 'Table 1', 'section' => null], $this->row($read, $ada)['seat']);

        $this->as($viewer, 'GET', $this->checkIn());
        self::assertSame(403, $this->statusCode());
        $this->as($stranger, 'GET', $this->checkIn());
        self::assertSame(404, $this->statusCode());

        self::em()->getConnection()->executeStatement('DELETE FROM event_people WHERE event_id = :event', ['event' => $this->eventId]);
        $ended = $this->as($door, 'GET', $this->checkIn());
        self::assertSame(404, $this->statusCode());
        self::assertStringNotContainsString('Table 1', Json\encode($ended));
    }

    /** @return array<string, mixed> */
    private function door(): array
    {
        $read = $this->as($this->owner, 'GET', $this->checkIn());
        self::assertSame(200, $this->statusCode(), Json\encode($read));

        return $read;
    }

    /**
     * @param array<string, mixed> $read
     *
     * @return array<string, mixed>
     */
    private function row(array $read, string $id): array
    {
        foreach (Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($read['guests'] ?? null) as $guest) {
            if ($id === $guest['id']) {
                return $guest;
            }
        }

        self::fail('no ' . $id . ' on the door');
    }

    /** @return list<array<string, mixed>> */
    private function companions(string $host): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->row($this->door(), $host)['companions']);
    }

    private function startPlan(): void
    {
        $this->as($this->owner, 'POST', $this->plan(), ['roomName' => 'Main hall', 'widthCm' => 2400, 'lengthCm' => 1800]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
    }

    private function addSection(string $name): string
    {
        $this->as($this->owner, 'POST', $this->plan() . '/sections', ['name' => $name]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        foreach ($this->planList('sections') as $section) {
            if ($name === $section['name']) {
                return Type\string()->coerce($section['id']);
            }
        }

        self::fail('no section ' . $name);
    }

    private function addTable(): string
    {
        return Type\string()->coerce($this->as($this->owner, 'POST', $this->plan() . '/tables', ['shape' => 'round'])['tableId'] ?? null);
    }

    /** @param array<string, mixed> $fields */
    private function patch(string $list, string $id, array $fields): void
    {
        $path = ['singleSeats' => 'seats'][$list] ?? $list;
        $this->as($this->owner, 'PATCH', $this->plan() . '/' . $path . '/' . $id, $fields, '"' . $this->versionOf($list, $id) . '"');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function versionOf(string $list, string $id): int
    {
        foreach ($this->planList($list) as $item) {
            if ($id === $item['id']) {
                return Type\int()->coerce($item['version']);
            }
        }

        self::fail('no ' . $id . ' in ' . $list);
    }

    /** @return list<array<string, mixed>> */
    private function planList(string $list): array
    {
        $plan = Type\shape(['plan' => Type\dict(Type\string(), Type\mixed())], true)->coerce($this->as($this->owner, 'GET', $this->plan())['seating'] ?? null);

        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($plan['plan'][$list] ?? null);
    }

    private function seat(string $guest, string $kind, string $place, ?int $seat = null): void
    {
        $this->as($this->owner, 'POST', $this->plan() . '/guests/seat', ['guestId' => $guest, 'kind' => $kind, 'placeId' => $place, 'seat' => $seat, 'justGuest' => true]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /** @param list<?string> $companions */
    private function guest(string $name, array $companions = [], bool $withNeeds = false): string
    {
        $body = $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests', [
            ...$withNeeds ? ['needs' => ['allergies' => ['peanuts'], 'note' => 'Step-free'], 'group' => ['name' => 'Family']] : [],
            'fullName' => $name,
            'companions' => Vec\map($companions, static fn (?string $companion): array => ['fullName' => $companion]),
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['guest' => Type\shape(['id' => Type\string()], true)], true)->coerce($body)['guest']['id'];
        $this->reply($id, 'coming');

        return $id;
    }

    private function reply(string $guest, string $answer): void
    {
        $this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/guests/' . $guest . '/record-reply', ['answer' => $answer, 'how' => 'phone', 'replace' => true]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function newEvent(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => "Amara & Tobi's wedding",
            'type' => 'wedding',
            'startsAt' => '2030-11-14T16:00',
            'endsAt' => '2030-11-15T02:00',
            'timeZone' => 'Africa/Lagos',
            'currency' => 'NGN',
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $id = Type\shape(['event' => Type\shape(['id' => Type\string()], true)], true)->coerce($body)['event']['id'];
        self::em()->getConnection()->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as($this->owner, 'POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function checkIn(): string
    {
        return '/api/events/' . $this->eventId . '/check-in';
    }

    private function plan(): string
    {
        return '/api/events/' . $this->eventId . '/seating-plan';
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, EventRole $on): User
    {
        $user = $this->account($address);
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
