<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Service\OrderMaker;
use App\Domain\Service\ServiceRead;
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
use App\Enum\ErrorCode;
use App\Enum\SectionColour;
use App\Enum\TableShape;
use App\Locale\NameNormaliser;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

final class ServiceStepsTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Event $event;

    private MenuCourse $course;

    private SeatingTable $table;

    /** @var array<string, Guest> */
    private array $guests = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2027-03-06T19:00:00Z'));
        $this->owner = $this->account('owner@ire.events', 'Ifeoma Nduka');
        $organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $body = $this->as('POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', ['name' => 'Owambe', 'type' => 'wedding', 'startsAt' => '2027-03-06T16:00', 'endsAt' => '2027-03-07T02:00']);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $this->event = self::em()->find(Event::class, Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id']) ?? self::fail('no event');

        $this->course = new MenuCourse($this->event, 'Main', null, 0);
        $this->course->listOwnItems(['Jollof rice', 'Plantain']);
        $plan = new SeatingPlan($this->event, null, 2000, 2000, null);
        $section = new SeatingSection($plan, 'Section A', NameNormaliser::key('Section A'), SectionColour::Blue, null);
        $this->table = new SeatingTable($plan, 'Table 1', NameNormaliser::key('Table 1'), TableShape::Round, 100, 100, null);
        $this->table->setSection($section);
        Iter\apply([$this->course, $plan, $section, $this->table], static fn (object $row) => self::em()->persist($row));

        foreach (['Adaeze Obi', 'Bola Ade', 'Chidi Eze', 'Dayo Ola', 'Ese Ugo'] as $seat => $name) {
            $guest = Guest::listed($this->event, $name, NameNormaliser::key($name), null, null, $this->owner, 'link-' . $seat, 'CODE' . $seat);
            self::em()->persist($guest);
            self::em()->persist(new SeatAssignment($guest, $this->table, $seat + 1));
            $this->guests[$name] = $guest;
        }

        self::em()->flush();
    }

    #[Test]
    public function firingMakesAnOrderAtToServeForEachArrivedGuestAndALateArrivalGetsTheirsAtOnce(): void
    {
        $this->arrive('Adaeze Obi', 'Bola Ade');
        $this->fire();

        $read = $this->read();
        $table = self::tableOf($read);

        self::assertSame(['toServe' => 2, 'dishing' => 0, 'checked' => 0, 'onItsWay' => 0, 'served' => 0], $table['counts']['stages']);
        self::assertSame([['key' => OrderMaker::CHEFS_CHOICE, 'name' => null], ['key' => 'jollof rice', 'name' => 'Jollof rice'], ['key' => 'plantain', 'name' => 'Plantain']], Vec\map(self::guestOf($table, 'Adaeze Obi')['order']['items'], static fn (array $item): array => ['key' => $item['key'], 'name' => $item['name']]));
        self::assertNull(self::guestOf($table, 'Chidi Eze')['order']);
        self::assertSame('notHereYet', self::guestOf($table, 'Chidi Eze')['noOrder']);

        $this->arrive('Chidi Eze');

        self::assertSame('toServe', self::guestOf(self::tableOf($this->read()), 'Chidi Eze')['order']['stage']);
    }

    #[Test]
    public function aTrayCarriesThreePlatesFromThePassToTheTableAndAllServedServesThem(): void
    {
        $this->arrive('Adaeze Obi', 'Bola Ade', 'Chidi Eze', 'Dayo Ola');
        $this->fire();

        $tray = $this->startTray();

        self::assertCount(3, $tray['plates'], 'up to 3 plates a tray, in seat order');
        self::assertSame('Pass', $tray['stops'][0]['name']);

        $this->post('/trays/' . $tray['id'] . '/take-to-table');
        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::PlateStageInvalid->type(), $this->last()['type'] ?? null);

        $this->post('/trays/' . $tray['id'] . '/check');
        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::TrayCheckIncomplete->type(), $this->last()['type'] ?? null);

        $this->markAll($tray, 'on');
        $this->post('/trays/' . $tray['id'] . '/check');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->post('/trays/' . $tray['id'] . '/take-to-table');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $served = $this->post('/trays/' . $tray['id'] . '/all-served');
        self::assertSame(200, $this->statusCode(), Json\encode($served));

        $stages = self::tableOf($this->read())['counts']['stages'];
        self::assertSame(3, $stages['served']);
        self::assertSame(1, $stages['toServe'], 'the fourth waits for the next tray');
    }

    #[Test]
    public function aGuestWithAnItemPreparingIsHeldUntilTheyChooseWhatsReadyNow(): void
    {
        $this->arrive('Adaeze Obi');
        $this->fire();

        $this->put('/course/' . $this->course->getId()->toRfc4122() . '/items', ['item' => 'plantain', 'state' => 'preparing', 'readyIn' => 7]);
        self::assertSame(422, $this->statusCode());

        $this->put('/course/' . $this->course->getId()->toRfc4122() . '/items', ['item' => 'plantain', 'state' => 'preparing', 'readyIn' => 10]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $order = self::guestOf(self::tableOf($this->read()), 'Adaeze Obi')['order'];
        self::assertTrue($order['held']);
        self::assertSame(1, self::tableOf($this->read())['counts']['held']);

        $this->post('/course/' . $this->course->getId()->toRfc4122() . '/trays', ['table' => $this->tableKey()]);
        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::TableNothingToServe->type(), $this->last()['type'] ?? null);

        $this->put('/plates/' . $order['id'] . '/choice', ['choice' => 'whatsReadyNow']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertFalse(self::guestOf(self::tableOf($this->read()), 'Adaeze Obi')['order']['held']);
        self::assertCount(1, $this->startTray()['plates']);
    }

    #[Test]
    public function anItemToBringAfterIsOwedAndGoesFirstOnTheNextTray(): void
    {
        $this->arrive('Adaeze Obi', 'Bola Ade', 'Chidi Eze', 'Dayo Ola');
        $this->fire();
        $tray = $this->startTray();
        $first = $tray['plates'][0];
        $this->markAll($tray, 'on');
        $this->put('/trays/' . $tray['id'] . '/marks', ['plateId' => $first, 'item' => 'plantain', 'mark' => 'bringAfter']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->post('/trays/' . $tray['id'] . '/check');
        $this->post('/trays/' . $tray['id'] . '/take-to-table');
        $this->post('/trays/' . $tray['id'] . '/plates/' . $first . '/served');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $waiting = self::tableOf($this->read())['plates'];
        self::assertSame('bringAfter', $waiting[0]['owedReason']);
        self::assertSame(['plantain'], Vec\map($waiting[0]['items'], static fn (array $item): string => $item['key']));

        $next = $this->startTray();
        self::assertSame($waiting[0]['id'], $next['plates'][0], 'owed plates go first');
    }

    #[Test]
    public function aPlateSentBackIsOwedAgainAndTheStepUndoesWithinTwoMinutes(): void
    {
        $this->arrive('Adaeze Obi');
        $this->fire();
        $tray = $this->startTray();
        $this->markAll($tray, 'on');
        $this->post('/trays/' . $tray['id'] . '/check');
        $this->post('/trays/' . $tray['id'] . '/take-to-table');
        $this->post('/trays/' . $tray['id'] . '/all-served');
        $plate = $tray['plates'][0];

        $this->post('/plates/' . $plate . '/sent-back', ['reason' => 'allergyConcern']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame('toServe', self::guestOf(self::tableOf($this->read()), 'Adaeze Obi')['order']['stage']);

        $this->post('/undo', ['subject' => $plate]);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        self::assertSame('served', self::guestOf(self::tableOf($this->read()), 'Adaeze Obi')['order']['stage']);

        $this->post('/plates/' . $plate . '/sent-back', ['reason' => 'dropped']);
        self::mockTime(new DateTimeImmutable('2027-03-06T19:02:01Z'));
        $this->post('/undo', ['subject' => $plate]);
        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::UndoExpired->type(), $this->last()['type'] ?? null);
    }

    #[Test]
    public function theReadWithNoViewerNamesNobody(): void
    {
        $this->arrive('Adaeze Obi');
        $this->fire();

        self::assertStringNotContainsString('Adaeze', Json\encode(self::service(ServiceRead::class)->of(self::em()->find(MenuCourse::class, $this->course->getId()) ?? self::fail('no course'), null)));
        self::assertSame('Adaeze Obi', self::guestOf(self::tableOf($this->read()), 'Adaeze Obi')['name']);
    }

    private function arrive(string ...$names): void
    {
        foreach ($names as $name) {
            $guest = self::em()->find(Guest::class, $this->guests[$name]->getId()) ?? self::fail('no guest');
            $by = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no owner');
            $guest->arrive(new DateTimeImmutable('2027-03-06T18:30:00Z'), $by);
            self::em()->flush();
            self::service(ServiceSteps::class)->arrived($guest, $by);
        }
    }

    private function fire(): void
    {
        $table = self::service(ServingTables::class)->find($this->event, $this->tableKey()) ?? self::fail('no table');
        $course = self::em()->find(MenuCourse::class, $this->course->getId()) ?? self::fail('no course');
        self::service(ServiceSteps::class)->fire($course, $table, self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no owner'));
    }

    private function tableKey(): string
    {
        return 'table:' . $this->table->getId()->toRfc4122();
    }

    /** @return array<string, mixed> */
    private function startTray(): array
    {
        $body = $this->post('/course/' . $this->course->getId()->toRfc4122() . '/trays', ['table' => $this->tableKey()]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));
        $trays = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\dict(Type\string(), Type\mixed())->coerce($body['service'])['trays']);

        return Iter\search($trays, static fn (array $tray): bool => $tray['id'] === $body['trayId']) ?? self::fail('no tray');
    }

    /** @param array<string, mixed> $tray */
    private function markAll(array $tray, string $mark): void
    {
        foreach (Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($tray['stops']) as $stop) {
            foreach (Type\vec(Type\shape(['plateId' => Type\string(), 'item' => Type\string()], true))->coerce($stop['marks']) as $one) {
                $this->put('/trays/' . $tray['id'] . '/marks', ['plateId' => $one['plateId'], 'item' => $one['item'], 'mark' => $mark]);
                self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
            }
        }
    }

    /** @return array<string, mixed> */
    private function read(): array
    {
        $body = $this->as('GET', '/api/events/' . $this->event->getId()->toRfc4122() . '/service/course/' . $this->course->getId()->toRfc4122());
        self::assertSame(200, $this->statusCode(), Json\encode($body));

        return Type\dict(Type\string(), Type\mixed())->coerce($body['service']);
    }

    /** @param array<string, mixed> $read */
    private static function tableOf(array $read): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($read['tables'])[0];
    }

    /** @param array<array-key, mixed> $table */
    private static function guestOf(array $table, string $name): array
    {
        $guests = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($table['guests']);

        return Iter\search($guests, static fn (array $guest): bool => $guest['name'] === $name) ?? self::fail('no guest ' . $name);
    }

    /** @param array<string, mixed>|null $body */
    private function post(string $path, ?array $body = null): array
    {
        return $this->as('POST', '/api/events/' . $this->event->getId()->toRfc4122() . '/service' . $path, $body ?? []);
    }

    /** @param array<string, mixed> $body */
    private function put(string $path, array $body): array
    {
        return $this->as('PUT', '/api/events/' . $this->event->getId()->toRfc4122() . '/service' . $path, $body);
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(string $method, string $path, ?array $body = null): array
    {
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($this->owner),
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
