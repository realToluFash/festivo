<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Staff\Station\StationPlan;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Event;
use App\Entity\Membership;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\SeatingPlan;
use App\Entity\SeatingSection;
use App\Entity\SeatingTable;
use App\Entity\StaffMember;
use App\Entity\StaffStation;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SectionColour;
use App\Enum\SeededRole;
use App\Enum\TableShape;
use App\Locale\NameNormaliser;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

/** Stations on an event (sc-3910): places and sections, who is on each and who leads, which place dishes each item, and the walking order. */
final class StationsTest extends ApiTestCase
{
    use ClockSensitiveTrait;
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
        self::mockTime(new DateTimeImmutable('2027-03-01T10:00:00Z'));
        $this->owner = $this->account('owner@ire.events', 'Ifeoma Nduka');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent();
    }

    #[Test]
    public function aNewEventStartsWithThePassThenTheSuggestedPlacesAndNobodyOnThem(): void
    {
        $places = $this->stations()['places'];

        self::assertSame(['Pass', 'Door', 'Bar', 'Kitchen', 'Stage', 'Floor'], Vec\map($places, static fn (array $one): string => $one['name']));
        self::assertTrue($places[0]['pass']);
        self::assertSame([], Vec\filter($places, static fn (array $one): bool => [] !== $one['people']));
        self::assertNull($this->stations()['floorLead']);
        self::assertSame([], $this->stations()['walk']);
    }

    #[Test]
    public function sectionsComeFromTheSeatingPlanInItsOrderWithTheirTables(): void
    {
        [$a, $b] = $this->sections('Section A', 'Section B', 'Section C');
        $this->tables($a, 6);
        $this->tables($b, 1);

        self::assertSame(
            [['Section A', 6], ['Section B', 1], ['Section C', 0]],
            Vec\map($this->stations()['sections'], static fn (array $one): array => [$one['name'], Iter\count($one['tables'])]),
        );
        self::assertSame(['Section B T1'], Vec\map($this->sectionRow('Section B')['tables'], static fn (array $table): string => $table['name']));
    }

    #[Test]
    public function aPlaceIsAddedAfterTheOthersAndRenamed(): void
    {
        $this->as($this->owner, 'POST', $this->path('places'), ['name' => '  Grill ']);
        self::assertSame(201, $this->statusCode());
        $grill = $this->place('Grill');
        self::assertSame('Grill', Iter\last($this->stations()['places'])['name'] ?? null);

        $this->as($this->owner, 'PUT', $this->path('places/' . $grill), ['name' => 'Braai']);

        self::assertSame(200, $this->statusCode());
        self::assertSame($grill, $this->place('Braai'));
    }

    /** @return iterable<string, array{string, string}> */
    public static function badNames(): iterable
    {
        yield 'blank' => ['   ', 'Enter a name for the station.'];
        yield 'over 60' => [Str\repeat('a', 61), 'Keep the name to 60 characters or fewer.'];
        yield 'a place, in another case' => ['bar', 'This event already has a place called Bar.'];
        yield 'a place, with accents' => ['Kítchen', 'This event already has a place called Kitchen.'];
        yield 'a seating section' => ['section a', 'Section A is a seating section on this event. Give the place another name.'];
    }

    #[Test]
    #[DataProvider('badNames')]
    public function aPlacesNameIsRequiredShortAndUniqueAmongStations(string $name, string $message): void
    {
        $this->sections('Section A');

        $this->as($this->owner, 'POST', $this->path('places'), ['name' => $name]);

        self::assertSame(422, $this->statusCode());
        self::assertSame($message, $this->violation('name'));
        self::assertCount(6, $this->stations()['places']);
    }

    #[Test]
    public function thePassIsNeitherRenamedNorRemoved(): void
    {
        $pass = $this->place('Pass');

        $this->as($this->owner, 'PUT', $this->path('places/' . $pass), ['name' => 'Hatch']);
        self::assertSame(422, $this->statusCode());

        $this->as($this->owner, 'DELETE', $this->path('places/' . $pass));
        self::assertSame(422, $this->statusCode());

        self::assertSame('Pass', $this->stations()['places'][0]['name']);
    }

    #[Test]
    public function aPersonHasOneStationAndTheRosterShowsIt(): void
    {
        $grace = $this->person('Grace Udo');
        $bar = $this->place('Bar');
        $door = $this->place('Door');

        $this->station($grace, $bar);
        $this->station($grace, $door);

        self::assertSame([], $this->placeRow('Bar')['people']);
        self::assertSame([$grace], $this->placeRow('Door')['people']);
        $entry = $this->staffEntry($grace);
        self::assertSame(['id' => $door, 'name' => 'Door', 'kind' => 'place', 'tables' => []], $entry['station']);
        self::assertSame([$entry['station']], $entry['stations']);

        $this->station($grace, null);
        self::assertNull($this->staffEntry($grace)['station']);
    }

    #[Test]
    public function aSecondStationIsOnlyTeamsAsWellAndGoesWithItsPlace(): void
    {
        $grace = $this->person('Grace Udo');
        $door = $this->place('Door');
        $bar = $this->place('Bar');
        $this->station($grace, $door);

        $person = self::em()->find(StaffMember::class, $grace) ?? self::fail('nobody');
        $person->setAsWellStation(self::em()->find(StaffStation::class, $bar));
        self::em()->flush();

        $entry = $this->staffEntry($grace);
        self::assertSame(['Door'], [$entry['station']['name'] ?? null]);
        self::assertSame(['Door', 'Bar'], Vec\map($entry['stations'], static fn (mixed $one): mixed => Type\shape(['name' => Type\string()], true)->coerce($one)['name']));
        self::assertSame([$grace], $this->placeRow('Bar')['people']);
        self::assertSame([$grace], $this->placeRow('Door')['people']);

        $this->as($this->owner, 'DELETE', $this->path('places/' . $bar));
        self::assertSame(['Door'], Vec\map($this->staffEntry($grace)['stations'], static fn (mixed $one): mixed => Type\shape(['name' => Type\string()], true)->coerce($one)['name']));
    }

    #[Test]
    public function aLeadIsOneOfTheStationsPeopleAndStopsLeadingWhenTheyLeave(): void
    {
        $grace = $this->person('Grace Udo');
        $kunle = $this->person('Kunle Ajayi');
        $bar = $this->place('Bar');
        $this->station($grace, $bar);

        $this->as($this->owner, 'PUT', $this->path($bar . '/lead'), ['lead' => $kunle]);
        self::assertSame(422, $this->statusCode());

        $this->as($this->owner, 'PUT', $this->path($bar . '/lead'), ['lead' => $grace]);
        self::assertSame(200, $this->statusCode());
        self::assertSame($grace, $this->placeRow('Bar')['lead']);
        self::assertTrue($this->staffEntry($grace)['leads']);

        $this->station($grace, $this->place('Door'));

        self::assertNull($this->placeRow('Bar')['lead']);
        self::assertFalse($this->staffEntry($grace)['leads']);
    }

    #[Test]
    public function theEventHasOneFloorLead(): void
    {
        $ifeoma = $this->person('Ifeoma Nduka');
        $grace = $this->person('Grace Udo');

        $this->as($this->owner, 'PUT', $this->path('floor-lead'), ['lead' => $ifeoma]);
        $this->as($this->owner, 'PUT', $this->path('floor-lead'), ['lead' => $grace]);

        self::assertSame(200, $this->statusCode());
        self::assertSame($grace, $this->stations()['floorLead']);
        self::assertFalse($this->staffEntry($ifeoma)['floorLead']);

        $this->as($this->owner, 'PUT', $this->path('floor-lead'), ['lead' => null]);
        self::assertNull($this->stations()['floorLead']);
    }

    #[Test]
    public function aSectionStationFollowsATableMovedToAnotherSection(): void
    {
        [$a, $b] = $this->sections('Section A', 'Section B');
        $tables = $this->tables($a, 2);
        $grace = $this->person('Grace Udo');
        $this->station($grace, $b->getId()->toRfc4122());
        self::assertSame([], $this->staffEntry($grace)['station']['tables'] ?? null);

        $table = self::em()->find(SeatingTable::class, $tables[0]->getId()) ?? self::fail('no table');
        $table->setSection(self::em()->find(SeatingSection::class, $b->getId()));
        self::em()->flush();

        $moved = [['id' => $tables[0]->getId()->toRfc4122(), 'name' => 'Section A T1']];
        self::assertSame([$grace], $this->sectionRow('Section B')['people']);
        self::assertSame($moved, $this->sectionRow('Section B')['tables']);
        self::assertSame(['id' => $b->getId()->toRfc4122(), 'name' => 'Section B', 'kind' => 'section', 'tables' => $moved], $this->staffEntry($grace)['station']);
        self::assertSame([['id' => $tables[1]->getId()->toRfc4122(), 'name' => 'Section A T2']], $this->sectionRow('Section A')['tables']);
    }

    #[Test]
    public function aStationWithNobodyOnItListsNobody(): void
    {
        $this->sections('Section A');

        self::assertSame([], $this->sectionRow('Section A')['people']);
        self::assertNull($this->sectionRow('Section A')['lead']);
    }

    #[Test]
    public function aSectionRemovedFromTheSeatingPlanLeavesItsPeopleWithNoStation(): void
    {
        [$d] = $this->sections('Section D');
        $grace = $this->person('Grace Udo');
        $this->station($grace, $d->getId()->toRfc4122());

        self::em()->remove(self::em()->find(SeatingSection::class, $d->getId()) ?? self::fail('no section'));
        self::em()->flush();

        $entry = $this->staffEntry($grace);
        self::assertNull($entry['station']);
        self::assertSame('Section D', $entry['stationRemoved']);
        self::assertSame([], $this->stations()['sections']);
    }

    #[Test]
    public function anItemWithNoStationANewItemAndARenamedItemAreDishedAtThePass(): void
    {
        [$course, $dish] = $this->course('Main', ['Jollof rice', 'Chicken']);
        $pass = $this->place('Pass');
        $kitchen = $this->place('Kitchen');

        self::assertSame([['Jollof rice', $pass], ['Chicken', $pass]], $this->items('Main'));

        $this->dish($course, 'Jollof rice', $kitchen);
        self::assertSame([['Jollof rice', $kitchen], ['Chicken', $pass]], $this->items('Main'));
        self::assertSame(1, $this->placeRow('Kitchen')['dishes']);

        $this->addDish($course, 'Plantain');
        $this->renameDish($dish, 'Smoky jollof');

        self::assertSame([['Smoky jollof', $pass], ['Chicken', $pass], ['Plantain', $pass]], $this->items('Main'));
        self::assertSame(0, $this->placeRow('Kitchen')['dishes']);
        self::assertSame([], $this->stations()['walk']);
    }

    #[Test]
    public function oneNameOnTwoDishesOfACourseIsOneItemWithOneStation(): void
    {
        [$course] = $this->course('Main', ['Rice', 'Chicken', 'rice']);
        $grill = $this->addPlace('Grill');

        $this->dish($course, 'RICE', $grill);

        self::assertSame([['Rice', $grill], ['Chicken', $this->place('Pass')]], $this->items('Main'));
        self::assertSame(1, $this->placeRow('Grill')['dishes']);
    }

    #[Test]
    public function placesJoinTheWalkingOrderAtTheEndLeaveItAndRejoinAtTheEnd(): void
    {
        [$course] = $this->course('Main', ['Rice', 'Chicken', 'Ice cream']);
        $kitchen = $this->place('Kitchen');
        $grill = $this->addPlace('Grill');
        $pastry = $this->addPlace('Pastry');

        $this->dish($course, 'Rice', $kitchen);
        $this->dish($course, 'Chicken', $grill);
        $this->dish($course, 'Ice cream', $pastry);
        self::assertSame([$kitchen, $grill, $pastry], $this->stations()['walk']);

        $this->dish($course, 'Rice', $this->place('Pass'));
        self::assertSame([$grill, $pastry], $this->stations()['walk']);

        $this->dish($course, 'Rice', $kitchen);
        self::assertSame([$grill, $pastry, $kitchen], $this->stations()['walk']);

        $this->as($this->owner, 'PUT', $this->path('walking-order'), ['order' => [$kitchen, $grill, $pastry]]);
        self::assertSame(200, $this->statusCode());
        self::assertSame([$kitchen, $grill, $pastry], $this->stations()['walk']);
    }

    #[Test]
    public function removingAPlaceLeavesItsPeopleWithNoStationAndItsItemsAtThePass(): void
    {
        [$course] = $this->course('Main', ['Chicken']);
        $grill = $this->addPlace('Grill');
        $tayo = $this->person('Tayo Bamidele');
        $this->station($tayo, $grill);
        $this->dish($course, 'Chicken', $grill);

        $this->as($this->owner, 'DELETE', $this->path('places/' . $grill));

        self::assertSame(200, $this->statusCode());
        self::assertNull($this->staffEntry($tayo)['station']);
        self::assertSame([['Chicken', $this->place('Pass')]], $this->items('Main'));
        self::assertSame([], $this->stations()['walk']);
    }

    #[Test]
    public function eachRefusalIsA422AndChangesNothing(): void
    {
        [$course] = $this->course('Main', ['Chicken']);
        [$other] = $this->course('Dessert', ['Ice cream']);
        [$section] = $this->sections('Section A');
        $kitchen = $this->place('Kitchen');
        $grill = $this->addPlace('Grill');
        $this->dish($course, 'Chicken', $kitchen);

        foreach ([
            ['courses/' . $course->getId()->toRfc4122() . '/dished-at', ['item' => 'Chicken', 'place' => $section->getId()->toRfc4122()]],
            ['courses/' . $other->getId()->toRfc4122() . '/dished-at', ['item' => 'Chicken', 'place' => $grill]],
            ['walking-order', ['order' => [$kitchen, $grill]]],
            ['walking-order', ['order' => []]],
            ['walking-order', ['order' => [$this->place('Pass'), $kitchen]]],
        ] as [$path, $body]) {
            $this->as($this->owner, 'PUT', $this->path($path), $body);
            self::assertSame(422, $this->statusCode(), $path . ' ' . Json\encode($body));
        }

        self::assertSame([['Chicken', $kitchen]], $this->items('Main'));
        self::assertSame([$kitchen], $this->stations()['walk']);
    }

    #[Test]
    public function changesAreAudited(): void
    {
        [$course] = $this->course('Main', ['Chicken']);
        $grace = $this->person('Grace Udo');
        $grill = $this->addPlace('Grill');
        $this->station($grace, $grill);
        $this->dish($course, 'Chicken', $grill);
        $this->as($this->owner, 'PUT', $this->path('floor-lead'), ['lead' => $grace]);

        $actions = Vec\map(self::em()->getRepository(AuditEntry::class)->findAll(), static fn (AuditEntry $entry): string => $entry->getAction());

        foreach ([StationPlan::PLACE_ADDED, StationPlan::PERSON_PLACED, StationPlan::ITEM_DISHED_AT, StationPlan::FLOOR_LEAD_SET] as $action) {
            self::assertContains($action, $actions);
        }
    }

    #[Test]
    public function anItemGivenThePassItIsAlreadyAtIsNotAudited(): void
    {
        [$course] = $this->course('Main', ['Chicken']);

        $this->dish($course, 'Chicken', $this->place('Pass'));

        self::assertSame([], self::em()->getRepository(AuditEntry::class)->findBy(['action' => StationPlan::ITEM_DISHED_AT]));
    }

    #[Test]
    public function assigningStationsLeavesTheSeatingPlanAndTheMenuAsTheyWere(): void
    {
        [$course, $dish] = $this->course('Main', ['Chicken']);
        [$a] = $this->sections('Section A');
        $this->tables($a, 1);
        $menu = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/menu');
        $plan = $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/seating-plan');

        $this->station($this->person('Grace Udo'), $a->getId()->toRfc4122());
        $this->dish($course, 'Chicken', $this->place('Kitchen'));

        self::assertSame($menu, $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/menu'));
        self::assertSame($plan, $this->as($this->owner, 'GET', '/api/events/' . $this->eventId . '/seating-plan'));
        self::assertSame('Chicken', (self::em()->find(MenuDish::class, $dish->getId()) ?? self::fail('no dish'))->getName());
    }

    #[Test]
    public function canViewSeesStationsButCannotChangeThem(): void
    {
        [$course] = $this->course('Main', ['Chicken']);
        $bar = $this->place('Bar');
        $sade = $this->person('Sade Lawal');
        $viewer = $this->member('ada@ire.events', 'Ada Obi', EventRole::CanView);

        $this->as($viewer, 'GET', $this->staff());
        self::assertSame(200, $this->statusCode());

        foreach ([
            ['POST', $this->path('places'), ['name' => 'Grill']],
            ['PUT', $this->path('places/' . $bar), ['name' => 'Grill']],
            ['DELETE', $this->path('places/' . $bar), null],
            ['PUT', $this->path('people/' . $sade), ['station' => $bar]],
            ['PUT', $this->path($bar . '/lead'), ['lead' => null]],
            ['PUT', $this->path('floor-lead'), ['lead' => $sade]],
            ['PUT', $this->path('courses/' . $course->getId()->toRfc4122() . '/dished-at'), ['item' => 'Chicken', 'place' => $bar]],
            ['PUT', $this->path('walking-order'), ['order' => []]],
        ] as [$method, $path, $body]) {
            $this->as($viewer, $method, $path, $body);
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
        }
    }

    #[Test]
    public function anotherOrganisationsEventIsNotFound(): void
    {
        $stranger = $this->account('stranger@else.where', 'Stranger');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        $this->as($stranger, 'POST', $this->path('places'), ['name' => 'Grill']);
        self::assertSame(404, $this->statusCode());
    }

    private function station(string $person, ?string $station): void
    {
        $this->as($this->owner, 'PUT', $this->path('people/' . $person), ['station' => $station]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function dish(MenuCourse $course, string $item, string $place): void
    {
        $this->as($this->owner, 'PUT', $this->path('courses/' . $course->getId()->toRfc4122() . '/dished-at'), ['item' => $item, 'place' => $place]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    private function addPlace(string $name): string
    {
        $this->as($this->owner, 'POST', $this->path('places'), ['name' => $name]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        return $this->place($name);
    }

    /** @return list<array{string, string}> */
    private function items(string $course): array
    {
        $found = Iter\search($this->stations()['courses'], static fn (array $one): bool => $one['name'] === $course) ?? self::fail('no course ' . $course);

        return Vec\map($found['items'], static fn (array $item): array => [$item['name'], $item['dishedAt']]);
    }

    private function place(string $name): string
    {
        return $this->placeRow($name)['id'];
    }

    /** @return array{id: string, name: string, pass: bool, people: list<string>, lead: ?string, dishes: int} */
    private function placeRow(string $name): array
    {
        return Iter\search($this->stations()['places'], static fn (array $one): bool => $one['name'] === $name) ?? self::fail('no place ' . $name);
    }

    /** @return array{id: string, name: string, tables: list<array{id: string, name: string}>, people: list<string>, lead: ?string} */
    private function sectionRow(string $name): array
    {
        return Iter\search($this->stations()['sections'], static fn (array $one): bool => $one['name'] === $name) ?? self::fail('no section ' . $name);
    }

    /** @return list<SeatingSection> */
    private function sections(string ...$names): array
    {
        $event = self::em()->find(Event::class, $this->eventId) ?? self::fail('no event');
        $plan = new SeatingPlan($event, null, 2000, 2000, null);
        self::em()->persist($plan);
        $sections = Vec\map(Vec\values($names), static function (string $name) use ($plan): SeatingSection {
            $section = new SeatingSection($plan, $name, NameNormaliser::key($name), SectionColour::Blue, null);
            self::em()->persist($section);
            self::em()->flush();

            return $section;
        });
        self::em()->flush();

        return $sections;
    }

    /** @return list<SeatingTable> */
    private function tables(SeatingSection $section, int $count): array
    {
        $tables = [];

        for ($n = 1; $n <= $count; ++$n) {
            $name = $section->getName() . ' T' . $n;
            $table = new SeatingTable($section->getPlan(), $name, NameNormaliser::key($name), TableShape::Round, 100 * $n, 100, null);
            $table->setSection($section);
            self::em()->persist($table);
            $tables[] = $table;
        }

        self::em()->flush();

        return $tables;
    }

    /**
     * @param list<string> $dishes
     *
     * @return array{MenuCourse, MenuDish}
     */
    private function course(string $name, array $dishes): array
    {
        $event = self::em()->find(Event::class, $this->eventId) ?? self::fail('no event');
        $existing = self::em()->getRepository(MenuCourse::class)->findBy(['event' => $event]);
        $course = new MenuCourse($event, $name, null, Iter\count($existing));
        self::em()->persist($course);
        $made = Vec\map($dishes, static function (string $dish) use ($course): MenuDish {
            $one = new MenuDish($course, null, $dish, null, null, [], 0);
            self::em()->persist($one);
            self::em()->flush();

            return $one;
        });
        self::em()->flush();

        return [$course, $made[0] ?? self::fail('no dish')];
    }

    private function addDish(MenuCourse $course, string $name): void
    {
        self::em()->persist(new MenuDish(self::em()->find(MenuCourse::class, $course->getId()) ?? self::fail('no course'), null, $name, null, null, [], 9));
        self::em()->flush();
    }

    private function renameDish(MenuDish $dish, string $name): void
    {
        (self::em()->find(MenuDish::class, $dish->getId()) ?? self::fail('no dish'))->rename($name, null);
        self::em()->flush();
    }

    private function person(string $name): string
    {
        $this->as($this->owner, 'POST', $this->staff(), ['fullName' => $name]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        return Type\shape(['id' => Type\string()], true)->coerce($this->last()['staff'] ?? null)['id'];
    }

    /** @return array{id: string, station: ?array{id: string, name: string, kind: string, tables: list<array{id: string, name: string}>}, stations: list<mixed>, stationRemoved: ?string, leads: bool, floorLead: bool, ...} */
    private function staffEntry(string $id): array
    {
        $body = $this->as($this->owner, 'GET', $this->staff());
        $staff = Type\vec(Type\shape([
            'id' => Type\string(),
            'station' => Type\nullable(Type\shape(['id' => Type\string(), 'name' => Type\string(), 'kind' => Type\string(), 'tables' => $this->tableList()])),
            'stations' => Type\vec(Type\mixed()),
            'stationRemoved' => Type\nullable(Type\string()),
            'leads' => Type\bool(),
            'floorLead' => Type\bool(),
        ], true))->coerce($body['staff'] ?? null);

        return Iter\search($staff, static fn (array $one): bool => $one['id'] === $id) ?? self::fail('nobody ' . $id);
    }

    /** @return array{places: list<array{id: string, name: string, pass: bool, people: list<string>, lead: ?string, dishes: int}>, sections: list<array{id: string, name: string, tables: list<array{id: string, name: string}>, people: list<string>, lead: ?string}>, floorLead: ?string, courses: list<array{id: string, name: string, items: list<array{name: string, dishedAt: string}>}>, walk: list<string>} */
    private function stations(): array
    {
        $body = $this->as($this->owner, 'GET', $this->staff());

        return Type\shape([
            'places' => Type\vec(Type\shape([
                'id' => Type\string(),
                'name' => Type\string(),
                'pass' => Type\bool(),
                'people' => Type\vec(Type\string()),
                'lead' => Type\nullable(Type\string()),
                'dishes' => Type\int(),
            ])),
            'sections' => Type\vec(Type\shape([
                'id' => Type\string(),
                'name' => Type\string(),
                'tables' => $this->tableList(),
                'people' => Type\vec(Type\string()),
                'lead' => Type\nullable(Type\string()),
            ])),
            'floorLead' => Type\nullable(Type\string()),
            'courses' => Type\vec(Type\shape([
                'id' => Type\string(),
                'name' => Type\string(),
                'items' => Type\vec(Type\shape(['name' => Type\string(), 'dishedAt' => Type\string()])),
            ])),
            'walk' => Type\vec(Type\string()),
        ])->coerce($body['stations'] ?? null);
    }

    /** @return Type\TypeInterface<list<array{id: string, name: string}>> */
    private function tableList(): Type\TypeInterface
    {
        return Type\vec(Type\shape(['id' => Type\string(), 'name' => Type\string()]));
    }

    private function newEvent(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2027-03-06T16:00',
            'endsAt' => '2027-03-07T02:00',
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function path(string $rest): string
    {
        return '/api/events/' . $this->eventId . '/stations/' . $rest;
    }

    private function staff(): string
    {
        return '/api/events/' . $this->eventId . '/staff';
    }

    private function violation(string $path): ?string
    {
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []);

        return Iter\search($violations, static fn (array $violation): bool => $violation['propertyPath'] === $path)['message'] ?? null;
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, string $name, EventRole $on): User
    {
        $user = $this->account($address, $name);
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
