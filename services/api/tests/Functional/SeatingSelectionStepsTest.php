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
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Mercure\Update;

final class SeatingSelectionStepsTest extends ApiTestCase
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
    public function renumberRenamesTablesAsOneStepAndNamesMayTradePlaces(): void
    {
        $first = $this->add('tables', ['shape' => 'round']);
        $second = $this->add('tables', ['shape' => 'round']);
        $third = $this->add('tables', ['shape' => 'round']);
        $published = $this->seatingPublished();

        $this->step('PATCH', 'names', [
            ['id' => $first['id'], 'version' => $first['version'], 'name' => 'Table 3'],
            ['id' => $second['id'], 'version' => $second['version'], 'name' => 'Table 1'],
            ['id' => $third['id'], 'version' => $third['version'], 'name' => 'Table 2'],
        ]);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['Table 3', 'Table 1', 'Table 2'], $this->names());
        self::assertSame($published + 1, $this->seatingPublished());
    }

    #[Test]
    public function renumberIsRefusedWholeByANameATableOutsideTheChoiceKeeps(): void
    {
        $first = $this->add('tables', ['shape' => 'round']);
        $second = $this->add('tables', ['shape' => 'round']);
        $this->add('tables', ['shape' => 'round']);

        $this->step('PATCH', 'names', [
            ['id' => $first['id'], 'version' => $first['version'], 'name' => 'Table 2'],
            ['id' => $second['id'], 'version' => $second['version'], 'name' => 'Table 3'],
        ]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('Table 3 is already taken by a table you did not choose.', $this->violation('items[1].name'));
        self::assertSame(['Table 1', 'Table 2', 'Table 3'], $this->names());
    }

    #[Test]
    public function aStepIsRefusedWholeWhenItNamesOneItemTwice(): void
    {
        $first = $this->add('tables', ['shape' => 'round']);
        $second = $this->add('tables', ['shape' => 'round']);

        $this->step('PATCH', 'names', [
            ['id' => $first['id'], 'version' => $first['version'], 'name' => 'Table 5'],
            ['id' => $second['id'], 'version' => $second['version'], 'name' => 'Table 6'],
            ['id' => $first['id'], 'version' => $first['version'], 'name' => 'Table 7'],
        ]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('Choose each item only once.', $this->violation('items'));
        self::assertSame(['Table 1', 'Table 2'], $this->names());
    }

    #[Test]
    public function sectionSetsEveryChosenItemsSectionAndNoneTakesItAway(): void
    {
        $answer = $this->as($this->owner, 'POST', $this->plan() . '/sections', ['name' => 'Terrace']);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));
        $sections = Type\shape(['plan' => Type\shape(['sections' => Type\vec(Type\shape(['id' => Type\string()], true))], true)], true)->coerce($answer['seating'] ?? null);
        $sectionId = $sections['plan']['sections'][0]['id'];
        $table = $this->add('tables', ['shape' => 'round']);
        $row = $this->add('rows');
        $seat = $this->add('seats');

        $this->step('PATCH', 'sections', [
            [...self::ref('table', $table), 'sectionId' => $sectionId],
            [...self::ref('row', $row), 'sectionId' => $sectionId],
            [...self::ref('seat', $seat), 'sectionId' => $sectionId],
        ]);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([[$sectionId], [$sectionId], [$sectionId]], [$this->names('tables', 'sectionId'), $this->names('rows', 'sectionId'), $this->names('singleSeats', 'sectionId')]);

        $now = $this->planNow();
        $this->step('PATCH', 'sections', [[...self::ref('table', $now['tables'][0]), 'sectionId' => null]]);
        self::assertSame(200, $this->statusCode());
        self::assertSame([null], $this->names('tables', 'sectionId'));
    }

    #[Test]
    public function duplicateCopiesKeepTheirArrangementEmptyAndAreNamedInReadingOrder(): void
    {
        $right = $this->add('tables', ['shape' => 'round']);
        $left = $this->add('tables', ['shape' => 'round']);
        $row = $this->add('rows');
        $this->step('PATCH', '', [
            [...self::ref('table', $right), 'xCm' => 900, 'yCm' => 400],
            [...self::ref('table', $left), 'xCm' => 400, 'yCm' => 410],
            [...self::ref('row', $row), 'xCm' => 700, 'yCm' => 1000],
        ]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $now = $this->planNow();

        $answer = $this->step('POST', 'duplicate', [self::ref('table', $now['tables'][0]), self::ref('table', $now['tables'][1]), self::ref('row', $now['rows'][0])]);

        self::assertSame(201, $this->statusCode(), Json\encode($answer));
        $after = $this->planNow();
        $copies = Vec\filter($after['tables'], static fn (array $one): bool => Iter\contains(['Table 3', 'Table 4'], $one['name']));
        self::assertSame([['Table 3', 450, 460], ['Table 4', 950, 450]], Vec\map(Vec\sort($copies, static fn (array $a, array $b): int => $a['name'] <=> $b['name']), fn (array $one): array => $this->pick($one, 'name', 'xCm', 'yCm')));
        self::assertSame(['A', 'B'], $this->names('rows', 'label'));
        self::assertCount(3, Type\vec(Type\string())->coerce($answer['chosen'] ?? null));
    }

    #[Test]
    public function aCopyOutsideTheRoomRefusesTheWholeDuplicate(): void
    {
        $inside = $this->add('tables', ['shape' => 'round']);
        $edge = $this->add('tables', ['shape' => 'round']);
        $this->step('PATCH', '', [[...self::ref('table', $edge), 'xCm' => 2250, 'yCm' => 900]]);
        $now = $this->planNow();

        $this->step('POST', 'duplicate', [self::ref('table', $inside), self::ref('table', $now['tables'][1])]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('The copy of Table 2 would sit outside the room, so nothing was added.', $this->violation('items'));
        self::assertCount(2, $this->planNow()['tables']);
    }

    #[Test]
    public function deleteTakesEveryChosenItemAndUndoPutsThemBack(): void
    {
        $table = $this->add('tables', ['shape' => 'rectangular']);
        $row = $this->add('rows');
        $seat = $this->add('seats');
        $before = $this->planNow();

        $this->step('POST', 'delete', [self::ref('table', $table), self::ref('row', $row), self::ref('seat', $seat)]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([[], [], []], [$this->planNow()['tables'], $this->planNow()['rows'], $this->planNow()['singleSeats']]);

        $t = $before['tables'][0];
        $r = $before['rows'][0];
        $s = $before['singleSeats'][0];
        $answer = $this->step('POST', 'restore', [
            ['kind' => 'table', 'name' => $t['name'], 'sectionId' => null, 'xCm' => $t['xCm'], 'yCm' => $t['yCm'], 'shape' => $t['shape'], 'seats' => $t['seats'], 'widthCm' => $t['widthCm'], 'lengthCm' => $t['lengthCm'], 'endSeats' => $t['endSeats'], 'rotation' => $t['rotation'], 'unusableSeats' => $t['unusableSeats']],
            ['kind' => 'row', 'name' => $r['label'], 'sectionId' => null, 'xCm' => $r['xCm'], 'yCm' => $r['yCm'], 'seats' => $r['seats'], 'spacingCm' => $r['spacingCm'], 'rotation' => $r['rotation'], 'unusableSeats' => $r['unusableSeats']],
            ['kind' => 'seat', 'name' => $s['name'], 'sectionId' => null, 'xCm' => $s['xCm'], 'yCm' => $s['yCm'], 'unusable' => $s['unusable']],
        ]);

        self::assertSame(201, $this->statusCode(), Json\encode($answer));
        $after = $this->planNow();
        $same = static fn (array $one): array => Dict\filter_keys($one, static fn (int|string $key): bool => !Iter\contains(['id', 'version', 'changedBy'], $key));
        self::assertSame([$same($t), $same($r), $same($s)], [$same($after['tables'][0]), $same($after['rows'][0]), $same($after['singleSeats'][0])]);
        self::assertCount(3, Type\vec(Type\string())->coerce($answer['chosen'] ?? null));
    }

    #[Test]
    public function aStaleItemRefusesEachStepWholeWith412(): void
    {
        $colleague = $this->member('bola@ire.events', 'Bola Ade', SeededRole::Member, EventRole::CanEdit);
        $mine = $this->add('tables', ['shape' => 'round']);
        $theirs = $this->add('tables', ['shape' => 'round']);
        $this->step('PATCH', '', [[...self::ref('table', $theirs), 'xCm' => 2000, 'yCm' => 400]], $colleague);
        self::assertSame(200, $this->statusCode());
        $chosen = [self::ref('table', $mine), self::ref('table', $theirs)];

        foreach ([['POST', 'delete', $chosen], ['POST', 'duplicate', $chosen], ['PATCH', 'sections', Vec\map($chosen, static fn (array $one): array => [...$one, 'sectionId' => null])], ['PATCH', 'names', [['id' => $mine['id'], 'version' => $mine['version'], 'name' => 'Top'], ['id' => $theirs['id'], 'version' => $theirs['version'], 'name' => 'Bottom']]]] as [$method, $path, $items]) {
            $this->step($method, $path, $items);
            self::assertSame(412, $this->statusCode(), $path);
            self::assertSame([$theirs['id']], $this->last()['stale'] ?? null, $path);
            self::assertSame('Bola Ade', $this->last()['changedBy'] ?? null, $path);
        }

        self::assertSame(['Table 1', 'Table 2'], $this->names());
    }

    #[Test]
    public function withoutSeatingManageEveryStepIs403AndAnotherOrganisationGets404(): void
    {
        $table = $this->add('tables', ['shape' => 'round']);
        $viewer = $this->member('ada@ire.events', 'Ada Viewer', SeededRole::Member, EventRole::CanView);
        $stranger = $this->account('stranger@else.where', 'Stranger');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        foreach ([[$viewer, 403], [$stranger, 404]] as [$who, $status]) {
            $this->step('POST', 'delete', [self::ref('table', $table)], $who);
            self::assertSame($status, $this->statusCode());
            $this->step('POST', 'duplicate', [self::ref('table', $table)], $who);
            self::assertSame($status, $this->statusCode());
            $this->step('PATCH', 'names', [['id' => $table['id'], 'version' => $table['version'], 'name' => 'Top']], $who);
            self::assertSame($status, $this->statusCode());
            $this->step('PATCH', 'sections', [[...self::ref('table', $table), 'sectionId' => null]], $who);
            self::assertSame($status, $this->statusCode());
            $this->step('POST', 'restore', [['kind' => 'seat', 'name' => 'Seat 9', 'sectionId' => null, 'xCm' => 300, 'yCm' => 300]], $who);
            self::assertSame($status, $this->statusCode());
        }

        self::assertSame(['Table 1'], $this->names());
    }

    /** The plan's own message: the room's numbers (sc-103) ride the same topic and are counted in SeatingNumbersTest. */
    private function seatingPublished(): int
    {
        return Iter\count(Vec\filter(self::service(RecordingHub::class)->published, fn (Update $update): bool => $update->getTopics() === ['events/' . $this->eventId . '/seating'] && !Str\contains($update->getData(), '"people"')));
    }

    /**
     * @param list<array<string, mixed>> $items
     *
     * @return array<string, mixed>
     */
    private function step(string $method, string $path, array $items, ?User $by = null): array
    {
        return $this->as($by ?? $this->owner, $method, $this->furniture() . ('' === $path ? '' : '/' . $path), ['items' => $items]);
    }

    /**
     * @param array<string, mixed> $item
     *
     * @return array{kind: string, id: mixed, version: mixed}
     */
    private static function ref(string $kind, array $item): array
    {
        return ['kind' => $kind, 'id' => $item['id'], 'version' => $item['version']];
    }

    /** @return list<mixed> */
    private function names(string $list = 'tables', string $key = 'name'): array
    {
        return Vec\map($this->planNow()[$list], static fn (array $one): mixed => $one[$key]);
    }

    /** @return array<string, mixed> the item it added */
    private function add(string $kind, mixed $body = null): array
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

    /** @return array<string, mixed> */
    private function as(User $user, string $method, string $path, mixed $body = null): array
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
