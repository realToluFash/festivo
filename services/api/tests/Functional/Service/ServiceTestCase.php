<?php

declare(strict_types=1);

namespace App\Tests\Functional\Service;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Service\ServiceSteps;
use App\Domain\Service\ServingTables;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MenuCourse;
use App\Entity\SeatAssignment;
use App\Entity\SeatingPlan;
use App\Entity\SeatingSection;
use App\Entity\SeatingTable;
use App\Entity\User;
use App\Enum\SectionColour;
use App\Enum\TableShape;
use App\Locale\NameNormaliser;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Psl\Iter;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** A wedding at 19:00 with a Main of Jollof rice and Plantain, and five guests at Table 1 in Section A, as sc-4005's tests share it. */
abstract class ServiceTestCase extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    protected const string PASSWORD = 'a decent passphrase';

    protected const array GUESTS = ['Adaeze Obi', 'Bola Ade', 'Chidi Eze', 'Dayo Ola', 'Ese Ugo'];

    protected User $owner;

    protected User $caller;

    protected Event $event;

    protected MenuCourse $course;

    protected SeatingPlan $plan;

    protected SeatingSection $section;

    protected SeatingTable $table;

    /** @var array<string, Guest> */
    protected array $guests = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-06T19:00:00Z'));
        $this->owner = $this->account('owner@ire.events', 'Ifeoma Nduka');
        $this->caller = $this->owner;
        $organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $body = $this->as('POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', ['name' => 'Owambe', 'type' => 'wedding', 'startsAt' => '2027-03-06T16:00', 'endsAt' => '2027-03-07T02:00']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $this->event = self::em()->find(Event::class, Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id']) ?? self::fail('no event');

        $this->course = new MenuCourse($this->event, 'Main', null, 0);
        $this->course->listOwnItems(['Jollof rice', 'Plantain']);
        $this->plan = new SeatingPlan($this->event, null, 2000, 2000, null);
        $this->section = new SeatingSection($this->plan, 'Section A', NameNormaliser::key('Section A'), SectionColour::Blue, null);
        $this->table = $this->tableIn($this->section, 'Table 1');
        Iter\apply([$this->course, $this->plan, $this->section], static fn (object $row) => self::em()->persist($row));

        foreach (self::GUESTS as $seat => $name) {
            $this->seat($name, $this->table, $seat + 1);
        }

        self::em()->flush();
    }

    protected function tableIn(SeatingSection $section, string $name): SeatingTable
    {
        $table = new SeatingTable($this->plan, $name, NameNormaliser::key($name), TableShape::Round, 100, 100, null);
        $table->setSection($section);
        self::em()->persist($table);

        return $table;
    }

    protected function seat(string $name, SeatingTable $table, int $seat): Guest
    {
        $guest = Guest::listed($this->event, $name, NameNormaliser::key($name), null, null, $this->owner, 'link-' . NameNormaliser::key($name), 'CODE' . Iter\count($this->guests));
        self::em()->persist($guest);
        self::em()->persist(new SeatAssignment($guest, $table, $seat));
        $this->guests[$name] = $guest;

        return $guest;
    }

    protected function arrive(string ...$names): void
    {
        foreach ($names as $name) {
            $guest = self::em()->find(Guest::class, $this->guests[$name]->getId()) ?? self::fail('no guest');
            $by = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no owner');
            self::service(ServiceSteps::class)->arrival($guest->getEvent(), $by, static function () use ($guest, $by): Guest {
                $guest->arrive(new DateTimeImmutable('2027-03-06T18:30:00Z'), $by);

                return $guest;
            });
        }
    }

    protected function fire(?MenuCourse $course = null, ?SeatingTable $table = null): void
    {
        $serving = self::service(ServingTables::class)->find($this->event, self::keyOf($table ?? $this->table)) ?? self::fail('no table');
        $this->fireAt($course ?? $this->course, $serving->key);
    }

    protected function fireAt(MenuCourse $course, string $tableKey): void
    {
        $serving = self::service(ServingTables::class)->find($this->event, $tableKey) ?? self::fail('no table ' . $tableKey);
        $course = self::em()->find(MenuCourse::class, $course->getId()) ?? self::fail('no course');
        self::service(ServiceSteps::class)->fire($course, $serving, self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no owner'));
    }

    protected static function keyOf(SeatingTable $table): string
    {
        return 'table:' . $table->getId()->toRfc4122();
    }

    protected function tableKey(): string
    {
        return self::keyOf($this->table);
    }

    protected function courseId(?MenuCourse $course = null): string
    {
        return ($course ?? $this->course)->getId()->toRfc4122();
    }

    /** @return array<array-key, mixed> the tray as the start's answer reads it */
    protected function startTray(?string $tableKey = null, ?MenuCourse $course = null): array
    {
        $body = $this->post('/course/' . $this->courseId($course) . '/trays', ['table' => $tableKey ?? $this->tableKey()]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return self::trayOf(Type\mixed_dict()->coerce($body['service']), Type\string()->coerce($body['trayId']));
    }

    /** @param array<array-key, mixed> $read */
    protected static function trayOf(array $read, string $id): array
    {
        $trays = Type\vec(Type\mixed_dict())->coerce($read['trays']);

        return Iter\search($trays, static fn (array $tray): bool => $tray['id'] === $id) ?? self::fail('no tray ' . $id);
    }

    /** @param array<array-key, mixed> $tray */
    protected static function marksOf(array $tray): array
    {
        return Vec\flat_map(
            Type\vec(Type\mixed_dict())->coerce($tray['stops']),
            static fn (array $stop): array => Type\vec(Type\shape(['plateId' => Type\string(), 'item' => Type\string()], true))->coerce($stop['marks']),
        );
    }

    /** @param array<array-key, mixed> $tray */
    protected function markAll(array $tray, string $mark): void
    {
        foreach (self::marksOf($tray) as $one) {
            $this->put('/trays/' . $tray['id'] . '/marks', ['plateId' => $one['plateId'], 'item' => $one['item'], 'mark' => $mark]);
            self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        }
    }

    /** @param array<array-key, mixed> $tray every item On, checked, and taken to the table */
    protected function toTheTable(array $tray): void
    {
        $this->markAll($tray, 'on');

        foreach (['/check', '/take-to-table'] as $step) {
            $this->post('/trays/' . $tray['id'] . $step);
            self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        }
    }

    protected function itemState(string $item, string $state, ?int $readyIn = null, ?MenuCourse $course = null): void
    {
        $this->put('/course/' . $this->courseId($course) . '/items', ['item' => $item, 'state' => $state, 'readyIn' => $readyIn]);
    }

    /** @return array<array-key, mixed> */
    protected function read(?MenuCourse $course = null): array
    {
        $body = $this->as('GET', '/api/events/' . $this->event->getId()->toRfc4122() . '/service/course/' . $this->courseId($course));
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\mixed_dict()->coerce($body['service']);
    }

    /** @param array<array-key, mixed> $read */
    protected static function tableOf(array $read, ?string $key = null): array
    {
        $tables = Type\vec(Type\mixed_dict())->coerce($read['tables']);

        return null === $key ? $tables[0] : Iter\search($tables, static fn (array $table): bool => $table['key'] === $key) ?? self::fail('no table ' . $key);
    }

    /** @param array<array-key, mixed> $table */
    protected function guestOf(array $table, string $name): array
    {
        $id = $this->guests[$name]->getId()->toRfc4122();
        $guests = Type\vec(Type\mixed_dict())->coerce($table['guests']);

        return Iter\search($guests, static fn (array $guest): bool => $guest['id'] === $id) ?? self::fail('no guest ' . $name);
    }

    /** @return array<array-key, mixed> the guest's order in the course's read */
    protected function orderOf(string $name, ?MenuCourse $course = null): array
    {
        return Type\mixed_dict()->coerce($this->guestOf(self::tableOf($this->read($course)), $name)['order']);
    }

    /** @param array<array-key, mixed> $order */
    protected static function itemKeys(array $order): array
    {
        return Vec\map(Type\vec(Type\shape(['key' => Type\string()], true))->coerce($order['items']), static fn (array $item): string => $item['key']);
    }

    protected function assertRefused(int $status, string $type): void
    {
        self::assertSame($status, $this->statusCode(), Json\encode($this->last()));
        self::assertSame($type, $this->last()['type'] ?? null);
    }

    /** @param array<array-key, mixed>|null $body */
    protected function post(string $path, ?array $body = null): array
    {
        return $this->as('POST', '/api/events/' . $this->event->getId()->toRfc4122() . '/service' . $path, $body ?? []);
    }

    /** @param array<array-key, mixed> $body */
    protected function put(string $path, array $body): array
    {
        return $this->as('PUT', '/api/events/' . $this->event->getId()->toRfc4122() . '/service' . $path, $body);
    }

    /** @return array<array-key, mixed> */
    protected function takeOff(string $trayId, string $plateId): array
    {
        return $this->as('DELETE', '/api/events/' . $this->event->getId()->toRfc4122() . '/service/trays/' . $trayId . '/plates/' . $plateId);
    }

    protected function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    /** @param array<array-key, mixed>|null $body */
    protected function as(string $method, string $path, ?array $body = null): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($this->caller),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ], content: null === $body ? null : Json\encode($body));

        return $this->last();
    }

    /** @return array<array-key, mixed> */
    protected function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\mixed_dict()->coerce(Json\decode($raw));
    }

    protected function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
