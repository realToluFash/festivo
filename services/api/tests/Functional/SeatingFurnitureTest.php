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
use Psl\Dict;
use Psl\Iter;
use Psl\Json;
use Psl\Type;
use Psl\Vec;

/** One step of moves, turns and resizes on the Floor plan, saved all or nothing, refused whole by a colleague's newer change or by the room's walls (sc-5028). */
final class SeatingFurnitureTest extends ApiTestCase
{
    use OnboardsAccounts;
    use PutsPeopleOnEvents;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = $this->account('owner@ire.events', 'Ada Owner');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent();
        $this->as($this->owner, 'POST', $this->plan(), ['roomName' => 'Main hall', 'widthCm' => 2400, 'lengthCm' => 1800]);
        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function aStepMovesTurnsAndResizesATableARowAndASeatTogetherAndPublishesOnce(): void
    {
        $table = $this->add('tables', ['shape' => 'rectangular']);
        $row = $this->add('rows');
        $seat = $this->add('seats');
        $published = Iter\count(self::service(RecordingHub::class)->published);

        $this->step([
            ['kind' => 'table', 'id' => $table['id'], 'version' => $table['version'], 'xCm' => 400, 'yCm' => 300, 'rotation' => 15, 'widthCm' => 240, 'lengthCm' => 90],
            ['kind' => 'row', 'id' => $row['id'], 'version' => $row['version'], 'xCm' => 1200, 'yCm' => 1500, 'rotation' => 90],
            ['kind' => 'seat', 'id' => $seat['id'], 'version' => $seat['version'], 'xCm' => 2000, 'yCm' => 200],
        ]);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $now = $this->planNow();
        self::assertSame([400, 300, 15, 240, 90], $this->pick($now['tables'][0], 'xCm', 'yCm', 'rotation', 'widthCm', 'lengthCm'));
        self::assertSame([1200, 1500, 90], $this->pick($now['rows'][0], 'xCm', 'yCm', 'rotation'));
        self::assertSame([2000, 200], $this->pick($now['singleSeats'][0], 'xCm', 'yCm'));
        self::assertSame($published + 1, Iter\count(self::service(RecordingHub::class)->published));
    }

    #[Test]
    public function aRoundTableResizesEvenlyAndDoesNotTurn(): void
    {
        $table = $this->add('tables', ['shape' => 'round']);

        $this->step([['kind' => 'table', 'id' => $table['id'], 'version' => $table['version'], 'xCm' => 1200, 'yCm' => 900, 'widthCm' => 200, 'lengthCm' => 120]]);
        self::assertSame(200, $this->statusCode());
        $now = $this->planNow()['tables'][0];
        self::assertSame([200, 200], $this->pick($now, 'widthCm', 'lengthCm'));

        $this->step([['kind' => 'table', 'id' => $table['id'], 'version' => $now['version'], 'xCm' => 1200, 'yCm' => 900, 'rotation' => 15]]);
        self::assertSame(422, $this->statusCode());
        self::assertSame('Only a rectangular or head table turns.', $this->violation('items[0].rotation'));
    }

    #[Test]
    public function aSeatNeitherTurnsNorResizesAndARowDoesNotResize(): void
    {
        $row = $this->add('rows');
        $seat = $this->add('seats');

        $this->step([['kind' => 'seat', 'id' => $seat['id'], 'version' => $seat['version'], 'xCm' => 600, 'yCm' => 600, 'rotation' => 15]]);
        self::assertSame(422, $this->statusCode());
        self::assertSame('A single seat does not turn.', $this->violation('items[0].rotation'));

        $this->step([['kind' => 'row', 'id' => $row['id'], 'version' => $row['version'], 'xCm' => 600, 'yCm' => 600, 'widthCm' => 400]]);
        self::assertSame(422, $this->statusCode());
        self::assertSame('Only a table changes its size here.', $this->violation('items[0].widthCm'));
    }

    #[Test]
    public function anItemLeftOutsideTheRoomRefusesTheWholeStepBesideIt(): void
    {
        $first = $this->add('tables', ['shape' => 'round']);
        $second = $this->add('tables', ['shape' => 'round']);
        $row = $this->add('rows');
        $before = $this->planNow();

        $this->step([
            ['kind' => 'table', 'id' => $first['id'], 'version' => $first['version'], 'xCm' => 300, 'yCm' => 300],
            ['kind' => 'table', 'id' => $second['id'], 'version' => $second['version'], 'xCm' => 2390, 'yCm' => 300],
            ['kind' => 'row', 'id' => $row['id'], 'version' => $row['version'], 'xCm' => 1200, 'yCm' => 1790],
        ]);

        self::assertSame(422, $this->statusCode());
        self::assertNull($this->violation('items[0]'));
        self::assertSame('Table 2 would sit outside the room.', $this->violation('items[1]'));
        self::assertSame('Row A would sit outside the room.', $this->violation('items[2]'));
        self::assertSame([$before['tables'], $before['rows']], [$this->planNow()['tables'], $this->planNow()['rows']]);
    }

    #[Test]
    public function aStepMeetingAColleaguesNewerChangeIsRefusedWholeNamingEveryStaleItem(): void
    {
        $colleague = $this->member('bola@ire.events', 'Bola Ade', SeededRole::Member, EventRole::CanEdit);
        $first = $this->add('tables', ['shape' => 'round']);
        $second = $this->add('tables', ['shape' => 'round']);
        $third = $this->add('tables', ['shape' => 'round']);

        foreach ([[$second, 400], [$third, 1400]] as [$theirs, $yCm]) {
            $this->as($colleague, 'PATCH', $this->furniture(), ['items' => [['kind' => 'table', 'id' => $theirs['id'], 'version' => $theirs['version'], 'xCm' => 2000, 'yCm' => $yCm]]]);
            self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        }
        $theirs = $this->planNow()['tables'];

        $this->step(Vec\map([$first, $second, $third], static fn (array $mine): array => ['kind' => 'table', 'id' => $mine['id'], 'version' => $mine['version'], 'xCm' => 300, 'yCm' => 300]));

        self::assertSame(412, $this->statusCode());
        self::assertSame([$second['id'], $third['id']], $this->last()['stale'] ?? null);
        self::assertSame('Bola Ade', $this->last()['changedBy'] ?? null);
        self::assertSame($theirs, $this->planNow()['tables']);
    }

    #[Test]
    public function nothingToMoveAndAnItemOffThisPlanAreRefused(): void
    {
        $this->step([]);
        self::assertSame(422, $this->statusCode());

        $this->step([['kind' => 'table', 'id' => '0192f0a0-0000-7000-8000-000000000000', 'version' => 1, 'xCm' => 300, 'yCm' => 300]]);
        self::assertSame(404, $this->statusCode());

        $row = $this->add('rows');
        $this->step([['kind' => 'table', 'id' => $row['id'], 'version' => $row['version'], 'xCm' => 300, 'yCm' => 300]]);
        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function withoutSeatingManageTheStepIs403AndNothingMoves(): void
    {
        $table = $this->add('tables', ['shape' => 'round']);
        $viewer = $this->member('ada@ire.events', 'Ada Viewer', SeededRole::Member, EventRole::CanView);

        $this->as($viewer, 'PATCH', $this->furniture(), ['items' => [['kind' => 'table', 'id' => $table['id'], 'version' => $table['version'], 'xCm' => 300, 'yCm' => 300]]]);

        self::assertSame(403, $this->statusCode());
        self::assertSame([1200, 900], $this->pick($this->planNow()['tables'][0], 'xCm', 'yCm'));
    }

    #[Test]
    public function anotherOrganisationsTableIsNotFound(): void
    {
        $table = $this->add('tables', ['shape' => 'round']);
        $stranger = $this->account('stranger@else.where', 'Stranger');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $this->as($stranger, 'PATCH', $this->furniture(), ['items' => [['kind' => 'table', 'id' => $table['id'], 'version' => $table['version'], 'xCm' => 300, 'yCm' => 300]]]);

        self::assertSame(404, $this->statusCode());
    }

    /** @param list<array<string, mixed>> $items */
    private function step(array $items): void
    {
        $this->as($this->owner, 'PATCH', $this->furniture(), ['items' => $items]);
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed> the item it added
     */
    private function add(string $kind, ?array $body = null): array
    {
        $answer = $this->as($this->owner, 'POST', $this->plan() . '/' . $kind, $body);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));
        [$list, $key] = match ($kind) {
            'tables' => ['tables', 'tableId'],
            'rows' => ['rows', 'rowId'],
            default => ['singleSeats', 'seatId'],
        };
        $plan = $this->planOf($answer['seating'] ?? null);

        foreach (Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($plan[$list]) as $one) {
            if ($one['id'] === $answer[$key]) {
                return $one;
            }
        }

        self::fail('not added');
    }

    /** @return list<mixed> */
    private function pick(mixed $item, string ...$keys): array
    {
        return Vec\values(Dict\select_keys(Type\dict(Type\string(), Type\mixed())->coerce($item), $keys));
    }

    /** @return array{tables: list<array<string, mixed>>, rows: list<array<string, mixed>>, singleSeats: list<array<string, mixed>>, ...} */
    private function planNow(): array
    {
        return $this->planOf($this->as($this->owner, 'GET', $this->plan())['seating'] ?? null);
    }

    /** @return array{tables: list<array<string, mixed>>, rows: list<array<string, mixed>>, singleSeats: list<array<string, mixed>>, ...} */
    private function planOf(mixed $seating): array
    {
        $items = Type\vec(Type\dict(Type\string(), Type\mixed()));

        return Type\shape(['tables' => $items, 'rows' => $items, 'singleSeats' => $items], true)->coerce(Type\dict(Type\string(), Type\mixed())->coerce($seating)['plan'] ?? null);
    }

    private function newEvent(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2026-11-14T16:00',
            'endsAt' => '2026-11-15T02:00',
        ]);
        self::assertSame(201, $this->statusCode());

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function plan(): string
    {
        return '/api/events/' . $this->eventId . '/seating-plan';
    }

    private function furniture(): string
    {
        return $this->plan() . '/furniture';
    }

    private function violation(string $path): ?string
    {
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []);

        foreach ($violations as $violation) {
            if ($violation['propertyPath'] === $path) {
                return $violation['message'];
            }
        }

        return null;
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, string $name, SeededRole $seeded, EventRole $on): User
    {
        $user = $this->account($address, $name);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]);
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
