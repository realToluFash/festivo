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
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Math;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** The tables in a seating plan: the four shapes, their fields and limits, duplicate and delete, the room that cannot shrink past them, and who may change them (sc-4000). */
final class SeatingTablesTest extends ApiTestCase
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
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent($this->owner, $this->organisation);
        $this->as($this->owner, 'POST', $this->plan(), ['roomName' => 'Main hall', 'widthCm' => 2400, 'lengthCm' => 1800]);
        self::assertSame(201, $this->statusCode());
    }

    /** @return iterable<string, array{string, int, int, int}> */
    public static function shapes(): iterable
    {
        yield 'round' => ['round', 180, 180, 10];
        yield 'rectangular' => ['rectangular', 180, 76, 6];
        yield 'head' => ['head', 240, 76, 4];
        yield 'cocktail' => ['cocktail', 60, 60, 4];
    }

    #[Test]
    #[DataProvider('shapes')]
    public function eachShapeIsAddedAtItsDefaultsInTheRoomsCentre(string $shape, int $widthCm, int $lengthCm, int $seats): void
    {
        $table = $this->addTable($shape);

        self::assertSame(201, $this->statusCode());
        self::assertSame('Table 1', $table['name']);
        self::assertSame($shape, $table['shape']);
        self::assertSame($widthCm, $table['widthCm']);
        self::assertSame($lengthCm, $table['lengthCm']);
        self::assertSame($seats, $table['seats']);
        self::assertSame(0, $table['endSeats']);
        self::assertSame(0, $table['rotation']);
        self::assertSame([1200, 900], [$table['xCm'], $table['yCm']]);
        self::assertSame([], $table['unusableSeats']);
        self::assertNull($table['sectionId']);
    }

    #[Test]
    public function theNextTableTakesTheNextFreeNumberAndTheNearestFreeFloor(): void
    {
        $first = $this->addTable('round');
        $second = $this->addTable('round');
        $this->change($first, ['name' => 'Top table']);
        $third = $this->addTable('round');

        self::assertSame('Table 2', $second['name']);
        self::assertSame('Table 1', $third['name']);
        self::assertNotSame([$first['xCm'], $first['yCm']], [$second['xCm'], $second['yCm']]);
        self::assertGreaterThanOrEqual(280, Iter\reduce([$second['xCm'] - $first['xCm'], $second['yCm'] - $first['yCm']], static fn (int $sum, int $d): int => $sum + Math\abs($d), 0));
    }

    #[Test]
    public function aShapeOutsideTheFourWordsIsRefused(): void
    {
        $this->as($this->owner, 'POST', $this->tables(), ['shape' => 'head_table']);

        self::assertSame(422, $this->statusCode());
        self::assertSame([], $this->tablesNow());
    }

    #[Test]
    public function aNewShapeKeepsTheSeatsAndTakesItsDefaultSize(): void
    {
        $table = $this->addTable('round');
        $table = $this->change($table, ['seats' => 8]);

        $rectangular = $this->change($table, ['shape' => 'rectangular']);

        self::assertSame(200, $this->statusCode());
        self::assertSame(8, $rectangular['seats']);
        self::assertSame([180, 76], [$rectangular['widthCm'], $rectangular['lengthCm']]);
        self::assertSame(0, $rectangular['endSeats']);

        $rectangular = $this->change($rectangular, ['endSeats' => 2, 'rotation' => 45]);
        $round = $this->change($rectangular, ['shape' => 'cocktail']);

        self::assertSame([60, 60, 0, 0, 8], [$round['widthCm'], $round['lengthCm'], $round['endSeats'], $round['rotation'], $round['seats']]);
    }

    #[Test]
    public function aRoundTablesDiameterIsItsWidthAndLength(): void
    {
        $table = $this->change($this->addTable('round'), ['widthCm' => 150]);

        self::assertSame([150, 150], [$table['widthCm'], $table['lengthCm']]);
    }

    /** @return iterable<string, array{string, array<string, mixed>, string, string}> */
    public static function refusedFields(): iterable
    {
        yield 'no seats' => ['rectangular', ['seats' => 0], 'seats', 'Enter a number of seats from 1 to 30.'];
        yield 'too many seats' => ['round', ['seats' => 31], 'seats', 'Enter a number of seats from 1 to 30.'];
        yield 'too many places' => ['cocktail', ['seats' => 31], 'seats', 'Enter a number of places from 1 to 30.'];
        yield 'too small' => ['round', ['widthCm' => 39], 'widthCm', 'Enter a size from 40 cm to 10 m.'];
        yield 'too long' => ['rectangular', ['lengthCm' => 1001], 'lengthCm', 'Enter a size from 40 cm to 10 m.'];
        yield 'more ends than seats' => ['rectangular', ['endSeats' => 7], 'endSeats', 'Enter 0 to 6, no more than the table has seats.'];
        yield 'fewer than no ends' => ['head', ['endSeats' => -1], 'endSeats', 'Enter 0 to 4, no more than the table has seats.'];
        yield 'ends on a round table' => ['round', ['endSeats' => 2], 'endSeats', 'Only a rectangular or head table has seats on the ends.'];
        yield 'a round table turned' => ['round', ['rotation' => 15], 'rotation', 'Only a rectangular or head table turns.'];
        yield 'a turn off the steps' => ['rectangular', ['rotation' => 20], 'rotation', 'Choose a rotation in 15° steps, from 0° to 345°.'];
        yield 'a blank name' => ['round', ['name' => '   '], 'name', 'Enter a name for the table.'];
        yield 'a long name' => ['round', ['name' => Str\repeat('a', 31)], 'name', 'Use 30 characters or fewer.'];
        yield 'a seat it does not have' => ['round', ['unusableSeats' => [11]], 'unusableSeats', 'Choose seats from 1 to 10, each once.'];
        yield 'a section of another plan' => ['round', ['sectionId' => '0190a3c4-0000-7000-8000-000000000000'], 'sectionId', "Choose one of this plan's sections, or no section."];
    }

    /** @param array<string, mixed> $fields */
    #[Test]
    #[DataProvider('refusedFields')]
    public function aFieldOutOfRangeIsRefusedBesideItAndNothingIsSaved(string $shape, array $fields, string $path, string $message): void
    {
        $table = $this->addTable($shape);

        $this->as($this->owner, 'PATCH', $this->tables() . '/' . $table['id'], $fields, '"' . $table['version'] . '"');

        self::assertSame(422, $this->statusCode());
        self::assertSame($message, $this->violation($path));
        self::assertSame($table, $this->tablesNow()[0]);
    }

    #[Test]
    public function inFeetASizeIsRefusedInWholeInchesInsideTheLimits(): void
    {
        $host = $this->account('host@party.us');
        $organisation = self::service(OrganisationFounder::class)->found($host, 'Party Co', 'US', 'America/New_York');
        self::em()->flush();
        $this->eventId = $this->newEvent($host, $organisation);
        $this->as($host, 'POST', $this->plan(), ['widthCm' => 2400, 'lengthCm' => 1800]);
        $table = $this->tableOf($this->as($host, 'POST', $this->tables(), ['shape' => 'round']));

        $this->as($host, 'PATCH', $this->tables() . '/' . $table['id'], ['widthCm' => 30], '"1"');

        self::assertSame('Enter a size from 1 ft 4 in to 32 ft 9 in.', $this->violation('widthCm'));
    }

    #[Test]
    public function aNameAlreadyInThePlanIsRefused(): void
    {
        $this->addTable('round');
        $second = $this->addTable('round');

        $this->as($this->owner, 'PATCH', $this->tables() . '/' . $second['id'], ['name' => ' table 1 '], '"1"');

        self::assertSame(422, $this->statusCode());
        self::assertSame('This plan already has a table called Table 1.', $this->violation('name'));
    }

    #[Test]
    public function fewerSeatsTakeTheEndsAndUnusableChairsDownWithThem(): void
    {
        $table = $this->change($this->addTable('rectangular'), ['seats' => 10, 'endSeats' => 4, 'unusableSeats' => [9, 2, 5]]);
        self::assertSame([2, 5, 9], $table['unusableSeats']);

        $table = $this->change($table, ['seats' => 3]);

        self::assertSame([3, 3, [2]], [$table['seats'], $table['endSeats'], $table['unusableSeats']]);
    }

    #[Test]
    public function aChairMarkedUnusableCanBeMarkedUsableAgain(): void
    {
        $table = $this->change($this->addTable('round'), ['unusableSeats' => [10]]);
        self::assertSame([10], $table['unusableSeats']);

        self::assertSame([], $this->change($table, ['unusableSeats' => []])['unusableSeats']);
    }

    #[Test]
    public function duplicateCopiesTheTableWithTheNextNumberSomewhereFree(): void
    {
        $section = $this->addSection('Terrace');
        $original = $this->change($this->addTable('head'), ['seats' => 8, 'endSeats' => 2, 'rotation' => 90, 'widthCm' => 300, 'sectionId' => $section, 'unusableSeats' => [3]]);

        $copy = $this->tableOf($this->as($this->owner, 'POST', $this->tables() . '/' . $original['id'] . '/duplicate', null, '"' . $original['version'] . '"'));

        self::assertSame(201, $this->statusCode());
        self::assertSame('Table 2', $copy['name']);
        self::assertNotSame($original['id'], $copy['id']);
        foreach (['shape', 'seats', 'widthCm', 'lengthCm', 'endSeats', 'rotation', 'sectionId', 'unusableSeats'] as $kept) {
            self::assertSame($original[$kept], $copy[$kept], $kept);
        }
        self::assertNotSame([$original['xCm'], $original['yCm']], [$copy['xCm'], $copy['yCm']]);
        self::assertSame(['tables' => 2, 'seats' => 16], Vec\map($this->planNow()['sections'], static fn (array $one): array => ['tables' => $one['tables'], 'seats' => $one['seats']])[0]);
    }

    #[Test]
    public function aDuplicatedEventCopiesItsTablesIntoTheCopiedSections(): void
    {
        $section = $this->addSection('Terrace');
        $table = $this->change($this->addTable('head'), ['seats' => 8, 'endSeats' => 2, 'sectionId' => $section, 'unusableSeats' => [3]]);
        $this->addTable('cocktail');

        $copy = Type\shape(['id' => Type\string()], true)->coerce($this->as($this->owner, 'POST', '/api/events/' . $this->eventId . '/duplicate', ['startsAt' => '2026-12-14T16:00'])['event'] ?? null)['id'];
        self::assertSame(201, $this->statusCode());

        $plan = $this->planOf($this->seating($this->as($this->owner, 'GET', '/api/events/' . $copy . '/seating-plan')));
        $copiedSection = Type\string()->coerce($plan['sections'][0]['id'] ?? null);
        self::assertNotSame($section, $copiedSection);
        $tables = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($plan['tables']);
        self::assertSame(['Table 1', 'Table 2'], Vec\map($tables, static fn (array $one): mixed => $one['name']));
        self::assertNotSame($table['id'], $tables[0]['id']);
        self::assertSame($copiedSection, $tables[0]['sectionId']);
        self::assertNull($tables[1]['sectionId']);
        foreach (['shape', 'seats', 'widthCm', 'lengthCm', 'endSeats', 'rotation', 'unusableSeats', 'xCm', 'yCm'] as $kept) {
            self::assertSame($table[$kept], $tables[0][$kept], $kept);
        }
    }

    #[Test]
    public function deleteTakesTheTableOutOfThePlan(): void
    {
        $table = $this->addTable('round');
        $kept = $this->addTable('cocktail');

        $this->as($this->owner, 'DELETE', $this->tables() . '/' . $table['id'], null, '"1"');

        self::assertSame(200, $this->statusCode());
        self::assertSame([$kept['id']], Vec\map($this->tablesNow(), static fn (array $one): string => $one['id']));
        self::assertSame(1, $this->planNow()['counts']['tables']);
    }

    #[Test]
    public function theCountsFollowTheTablesBySection(): void
    {
        $section = $this->addSection('Terrace');
        $this->change($this->addTable('round'), ['sectionId' => $section]);
        $this->addTable('rectangular');
        $this->addTable('cocktail');

        $plan = $this->planNow();

        self::assertSame(3, $plan['counts']['tables']);
        self::assertSame(['tables' => 1, 'seats' => 10], ['tables' => $plan['sections'][0]['tables'], 'seats' => $plan['sections'][0]['seats']]);
        self::assertSame(['tables' => 2, 'seats' => 10], $plan['withoutSection']);
    }

    #[Test]
    public function deletingASectionLeavesItsTablesWhereTheyAreWithNoSection(): void
    {
        $section = $this->addSection('Terrace');
        $table = $this->change($this->addTable('round'), ['sectionId' => $section]);

        $this->as($this->owner, 'DELETE', $this->plan() . '/sections/' . $section);

        self::assertSame(200, $this->statusCode());
        $now = $this->tablesNow()[0];
        self::assertNull($now['sectionId']);
        self::assertSame([$table['xCm'], $table['yCm']], [$now['xCm'], $now['yCm']]);
    }

    #[Test]
    public function deletingThePlanDeletesItsTables(): void
    {
        $this->addTable('round');
        $this->addTable('head');

        $this->as($this->owner, 'DELETE', $this->plan());
        self::assertSame(200, $this->statusCode());
        $this->as($this->owner, 'POST', $this->plan(), ['widthCm' => 2400, 'lengthCm' => 1800]);

        self::assertSame([], $this->tablesNow());
    }

    #[Test]
    public function theRoomCannotShrinkPastATableAndItsChairs(): void
    {
        $table = $this->addTable('round');

        $this->as($this->owner, 'PATCH', $this->plan(), ['widthCm' => 1300], '"1"');

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/seating_items_outside', $this->last()['type'] ?? null);
        self::assertSame('1 item sits outside 13 m × 18 m. Move them first.', $this->last()['detail'] ?? null);
        self::assertSame([$table['id']], $this->last()['outside'] ?? null);
        self::assertSame(2400, $this->planNow()['widthCm']);

        $this->as($this->owner, 'PATCH', $this->plan(), ['widthCm' => 1400], '"1"');
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function theRoomCannotShrinkFurtherPastATableAlreadyThroughItsWall(): void
    {
        $table = $this->addTable('round');
        $this->as($this->owner, 'PATCH', $this->plan(), ['widthCm' => 1400], '"1"');
        self::assertSame(200, $this->statusCode());
        $table = $this->change($table, ['widthCm' => 400]);

        $this->as($this->owner, 'PATCH', $this->plan(), ['widthCm' => 1300], '"2"');

        self::assertSame(409, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([$table['id']], $this->last()['outside'] ?? null);
        self::assertSame(1400, $this->planNow()['widthCm']);

        $this->as($this->owner, 'PATCH', $this->plan(), ['lengthCm' => 1700], '"2"');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function everyTableChangeIsPublishedWholeOnTheEventsSeatingTopic(): void
    {
        $table = $this->addTable('round');
        self::assertSame([[$table['id'], 10]], $this->publishedTables());

        $table = $this->change($table, ['seats' => 8]);
        self::assertSame([[$table['id'], 8]], $this->publishedTables());

        $copy = $this->tableOf($this->as($this->owner, 'POST', $this->tables() . '/' . $table['id'] . '/duplicate', null, '"' . $table['version'] . '"'));
        self::assertSame([[$table['id'], 8], [$copy['id'], 8]], $this->publishedTables());

        $this->as($this->owner, 'DELETE', $this->tables() . '/' . $table['id'], null, '"' . $table['version'] . '"');
        self::assertSame(200, $this->statusCode());
        self::assertSame([[$copy['id'], 8]], $this->publishedTables());
    }

    #[Test]
    public function aStaleVersionIs412NamingWhoChangedItAndNoVersionIs428(): void
    {
        $table = $this->addTable('round');
        $this->change($table, ['seats' => 8]);

        foreach ([
            ['PATCH', $this->tables() . '/' . $table['id'], ['seats' => 6]],
            ['POST', $this->tables() . '/' . $table['id'] . '/duplicate', null],
            ['DELETE', $this->tables() . '/' . $table['id'], null],
        ] as [$method, $path, $body]) {
            $this->as($this->owner, $method, $path, $body, '"1"');
            self::assertSame(412, $this->statusCode(), $method . ' ' . $path);
            self::assertSame('Person', $this->last()['changedBy'] ?? null);

            $this->as($this->owner, $method, $path, $body);
            self::assertSame(428, $this->statusCode(), $method . ' ' . $path);
        }

        self::assertSame(8, $this->tablesNow()[0]['seats']);
    }

    /** @return iterable<string, array{EventRole}> */
    public static function readOnlyRoles(): iterable
    {
        yield 'Can view' => [EventRole::CanView];
        yield 'Can check guests in' => [EventRole::CanCheckIn];
    }

    #[Test]
    #[DataProvider('readOnlyRoles')]
    public function aReadOnlyRoleSeesTheTablesButCannotChangeThem(EventRole $role): void
    {
        $table = $this->addTable('round');
        $viewer = $this->member('ada@ire.events', SeededRole::Member, $role);

        self::assertSame([$table], Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->planOf($this->seating($this->as($viewer, 'GET', $this->plan())))['tables']));

        foreach ([
            ['POST', $this->tables(), ['shape' => 'round']],
            ['PATCH', $this->tables() . '/' . $table['id'], ['seats' => 6]],
            ['POST', $this->tables() . '/' . $table['id'] . '/duplicate', null],
            ['DELETE', $this->tables() . '/' . $table['id'], null],
        ] as [$method, $path, $body]) {
            $this->as($viewer, $method, $path, $body, '"1"');
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
        }

        self::assertSame([$table], $this->tablesNow());
    }

    #[Test]
    public function anotherOrganisationsTableIsNotFound(): void
    {
        $table = $this->addTable('round');
        $stranger = $this->account('stranger@else.where');
        $theirs = self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $theirEvent = $this->newEvent($stranger, $theirs);

        $this->as($stranger, 'PATCH', '/api/events/' . $this->eventId . '/seating-plan/tables/' . $table['id'], ['seats' => 6], '"1"');
        self::assertSame(404, $this->statusCode());

        $this->as($stranger, 'POST', '/api/events/' . $theirEvent . '/seating-plan', ['widthCm' => 2400, 'lengthCm' => 1800]);
        $this->as($stranger, 'PATCH', '/api/events/' . $theirEvent . '/seating-plan/tables/' . $table['id'], ['seats' => 6], '"1"');
        self::assertSame(404, $this->statusCode());
    }

    /** @return array<string, mixed> */
    private function addTable(string $shape): array
    {
        return $this->tableOf($this->as($this->owner, 'POST', $this->tables(), ['shape' => $shape]));
    }

    private function addSection(string $name): string
    {
        $sections = $this->planOf($this->seating($this->as($this->owner, 'POST', $this->plan() . '/sections', ['name' => $name])))['sections'];
        self::assertSame(201, $this->statusCode());

        return Type\string()->coerce((Iter\last($sections) ?? self::fail('no section'))['id']);
    }

    /**
     * @param array<string, mixed> $table
     * @param array<string, mixed> $fields
     *
     * @return array<string, mixed>
     */
    private function change(array $table, array $fields): array
    {
        $changed = $this->tableOf($this->as($this->owner, 'PATCH', $this->tables() . '/' . Type\string()->coerce($table['id']), $fields, '"' . Type\int()->coerce($table['version']) . '"'));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $changed;
    }

    /** @return array<string, mixed> */
    private function tableOf(mixed $body): array
    {
        $id = Type\string()->coerce(Type\dict(Type\string(), Type\mixed())->coerce($body)['tableId'] ?? null);

        foreach (Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->planOf($this->seating($body))['tables']) as $table) {
            if ($table['id'] === $id) {
                return $table;
            }
        }

        self::fail('no table ' . $id);
    }

    /** @return list<array{0: string, 1: int}> each table's id and seats in the last update on this event's seating topic */
    private function publishedTables(): array
    {
        $update = Iter\last(self::service(RecordingHub::class)->published) ?? self::fail('nothing published');
        self::assertSame(['events/' . $this->eventId . '/seating'], $update->getTopics());
        $published = Type\shape(['plan' => Type\shape(['tables' => Type\vec(Type\shape(['id' => Type\string(), 'seats' => Type\int()], true))], true)], true)->coerce(Json\decode($update->getData()));

        return Vec\map($published['plan']['tables'], static fn (array $one): array => [$one['id'], $one['seats']]);
    }

    /** @return list<array<string, mixed>> */
    private function tablesNow(): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->planNow()['tables']);
    }

    /** @return array{sections: list<array<string, mixed>>, tables: mixed, withoutSection: mixed, counts: array<string, int>, widthCm: int, ...} */
    private function planNow(): array
    {
        return $this->planOf($this->seating($this->as($this->owner, 'GET', $this->plan())));
    }

    private function newEvent(User $by, Organisation $organisation): string
    {
        $body = $this->as($by, 'POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', [
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

    private function tables(): string
    {
        return $this->plan() . '/tables';
    }

    /** @return array<string, mixed> */
    private function seating(mixed $body): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce(Type\dict(Type\string(), Type\mixed())->coerce($body)['seating'] ?? null);
    }

    /** @return array{sections: list<array<string, mixed>>, tables: mixed, withoutSection: mixed, counts: array<string, int>, widthCm: int, ...} */
    private function planOf(mixed $seating): array
    {
        return Type\shape([
            'widthCm' => Type\int(),
            'sections' => Type\vec(Type\dict(Type\string(), Type\mixed())),
            'tables' => Type\mixed(),
            'withoutSection' => Type\mixed(),
            'counts' => Type\dict(Type\string(), Type\int()),
        ], true)->coerce(Type\dict(Type\string(), Type\mixed())->coerce($seating)['plan'] ?? null);
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

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, SeededRole $seeded, EventRole $on): User
    {
        $user = $this->account($address);
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
