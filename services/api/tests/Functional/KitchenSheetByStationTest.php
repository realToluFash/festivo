<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\MenuDishChoice;
use App\Entity\MenuDishVariant;
use App\Entity\Organisation;
use App\Entity\StaffStation;
use App\Entity\User;
use App\Enum\Permission;
use App\Repository\StaffStationRepository;
use App\Tests\ApiTestCase;
use App\Tests\Double\ScriptedPdfMaker;
use App\Tests\Double\WithholdingMembershipDirectory;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\File;
use Psl\Filesystem;
use Psl\Iter;
use Psl\Json;
use Psl\Shell;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

/** sc-34244: under each course of the kitchen sheet, each station's items with the plates that hold them, the Pass first and then the walking order. */
final class KitchenSheetByStationTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private string $eventId;

    private MenuCourse $main;

    private MenuCourse $dessert;

    /** @var array<string, string> */
    private array $ids = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime(new DateTimeImmutable('2026-10-03T09:00:00+00:00'));
        $this->owner = $this->account('owner@ire.events');
        $organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->live($organisation);
        $event = self::em()->find(Event::class, Uuid::fromString($this->eventId)) ?? self::fail('no event');

        $starter = new MenuCourse($event, 'Starter', null, 0);
        $starter->setGuestsChoose(false);
        $soup = new MenuDish($starter, null, 'Catfish pepper soup', null, ['fish'], [], 0);

        $this->main = new MenuCourse($event, 'Main', null, 1);
        $this->main->setSkippable(true);
        $this->main->listOwnItems(['Pepper sauce', 'jollof rice ']);
        $jollof = new MenuDish($this->main, null, 'Jollof rice', null, [], [], 0);
        $jollof->listItems([['kind' => 'fixed', 'name' => 'Jollof rice'], ['kind' => 'fixed', 'name' => 'Plantain']]);
        $coconut = new MenuDish($this->main, null, 'Coconut rice', null, [], [], 1);
        $chicken = new MenuDishVariant($coconut, 'Chicken', false, [], [], null, 0);
        $beef = new MenuDishVariant($coconut, 'Beef', false, [], [], null, 1);
        $side = new MenuDishChoice($coconut, 'And a side?', 1, true, 0);
        $plantain = new MenuChoiceOption($side, 'Plantain', [], 0);
        $moimoi = new MenuChoiceOption($side, 'Moi moi', [], 1);
        $yam = new MenuChoiceOption($side, 'Fried yam', [], 2);
        $coconut->listItems([['kind' => 'fixed', 'name' => 'Coconut rice'], ['kind' => 'variants'], ['kind' => 'choice', 'choiceId' => $side->getId()->toRfc4122()]]);
        $egusi = new MenuDish($this->main, null, 'Pounded yam and egusi', null, [], [], 2);

        $this->dessert = new MenuCourse($event, 'Dessert', null, 2);
        $this->dessert->setSkippable(true);
        $zobo = new MenuDish($this->dessert, null, 'Zobo sorbet', null, [], [], 0);
        $toppings = new MenuDishChoice($zobo, 'Toppings?', 2, false, 0);
        $fruit = new MenuChoiceOption($toppings, 'Fruit salad', [], 0);
        $puff = new MenuChoiceOption($toppings, 'Puff-puff', [], 1);
        $flakes = new MenuChoiceOption($toppings, 'Coconut flakes', [], 2);
        $zobo->listItems([['kind' => 'fixed', 'name' => 'Zobo sorbet'], ['kind' => 'choice', 'choiceId' => $toppings->getId()->toRfc4122()]]);
        $chinchin = new MenuDish($this->dessert, null, 'Chin chin', null, [], [], 1);

        $rows = [$starter, $soup, $this->main, $jollof, $coconut, $chicken, $beef, $side, $plantain, $moimoi, $yam, $egusi, $this->dessert, $zobo, $toppings, $fruit, $puff, $flakes, $chinchin];
        Iter\apply($rows, static fn (object $row) => self::em()->persist($row));
        self::em()->flush();

        foreach (['jollof' => $jollof, 'coconut' => $coconut, 'chicken' => $chicken, 'beef' => $beef, 'plantain' => $plantain, 'moimoi' => $moimoi, 'egusi' => $egusi, 'zobo' => $zobo, 'fruit' => $fruit, 'puff' => $puff, 'chinchin' => $chinchin] as $key => $row) {
            $this->ids[$key] = $row->getId()->toRfc4122();
        }
    }

    #[Test]
    public function eachItemIsCountedOnThePlatesThatHoldItUnderItsStationInTheWalkingOrder(): void
    {
        $this->picked();
        $grill = $this->addPlace('Grill');
        $kitchen = $this->place('Kitchen');

        foreach (['Jollof rice', 'Plantain', 'Coconut rice', 'Moi moi', 'Fried yam'] as $item) {
            $this->dishAt($this->main, $item, $kitchen);
        }

        $this->dishAt($this->main, 'Chicken', $grill);
        $this->dishAt($this->main, 'Beef', $grill);

        $sheet = $this->sheet();

        self::assertNull(self::course($sheet, 'Starter')['stations'], 'a course with no items, all at the Pass, is sc-3911’s block');
        self::assertSame([
            ['Pass', [['Pounded yam and egusi', 1, false], ['Pepper sauce', 6, false], ['', 2, true]]],
            ['Kitchen', [['Jollof rice', 6, false], ['Plantain', 2, false], ['Coconut rice', 2, false], ['Moi moi', 1, false], ['Fried yam', 0, false]]],
            ['Grill', [['Chicken', 1, false], ['Beef', 1, false]]],
        ], self::stations($sheet, 'Main'), 'Jollof rice is on a dish and the course’s own, Plantain on two dishes: each guest once; Emeka skipped is in none; Funke’s Kitchen’s choice and Gbenga not chosen yet are Chef’s choice and hold the course’s own items');
        self::assertSame([
            ['Pass', [['Zobo sorbet', 2, false], ['Fruit salad', 1, false], ['Puff-puff', 1, false], ['Coconut flakes', 0, false], ['Chin chin', 1, false], ['', 3, true]]],
        ], self::stations($sheet, 'Dessert'), 'two options of one choice count once each, None for me nowhere, and the Grill, serving nothing here, is not listed');
        $this->assertSameAsSeePicks($sheet);

        $this->as('PUT', '/api/events/' . $this->eventId . '/stations/walking-order', ['order' => [$grill, $kitchen]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame(['Pass', 'Grill', 'Kitchen'], Vec\map(self::stations($this->sheet(), 'Main'), static fn (array $one): string => $one[0]));
    }

    #[Test]
    public function aDefaultsUnansweredOptionalChoiceIsChefsChoiceOnTopOfItsDishsItems(): void
    {
        $this->picked();
        $this->as('PUT', '/api/events/' . $this->eventId . '/menu/courses/' . $this->dessert->getId()->toRfc4122(), ['name' => 'Dessert', 'answer' => 'choose', 'skippable' => true, 'default' => ['dish' => $this->ids['zobo'], 'chooseBy' => '2026-10-10']]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::mockTime(new DateTimeImmutable('2026-10-11T09:00:00+00:00'));
        $sheet = $this->sheet();

        self::assertSame([
            ['Pass', [['Zobo sorbet', 5, false], ['Fruit salad', 1, false], ['Puff-puff', 1, false], ['Coconut flakes', 0, false], ['Chin chin', 1, false], ['', 3, true]]],
        ], self::stations($sheet, 'Dessert'), 'the three given the default have no answer to Toppings, so each is once in Chef’s choice as well as on Zobo sorbet');
        $this->assertSameAsSeePicks($sheet);
    }

    #[Test]
    public function chefsChoiceIsNotShownAtZero(): void
    {
        $token = $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $this->meals($token, [
            ['person' => $this->personId('Bisi Adewale'), 'course' => $this->id($this->dessert), 'answer' => 'chosen', 'dish' => $this->ids['chinchin']],
            ['person' => $this->personId('Chidi Okonkwo'), 'course' => $this->id($this->dessert), 'answer' => 'skipped'],
        ]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame([['Pass', [['Zobo sorbet', 0, false], ['Fruit salad', 0, false], ['Puff-puff', 0, false], ['Coconut flakes', 0, false], ['Chin chin', 1, false]]]], self::stations($this->sheet(), 'Dessert'));
    }

    #[Test]
    public function aCourseWithNoItemsHasByStationOnceOneOfItsDishesIsServedFromAPlace(): void
    {
        $this->coming([]);
        self::assertNull(self::course($this->sheet(), 'Starter')['stations']);

        $starter = self::em()->getRepository(MenuCourse::class)->findOneBy(['name' => 'Starter']) ?? self::fail('no starter');
        $this->dishAt($starter, 'Catfish pepper soup', $this->place('Kitchen'));

        self::assertSame([['Kitchen', [['Catfish pepper soup', 1, false]]]], self::stations($this->sheet(), 'Starter'));
    }

    #[Test]
    public function theLinesAreTheSameWithoutGuestsManageOrStaffRead(): void
    {
        $this->picked();
        $this->dishAt($this->main, 'Chicken', $this->addPlace('Grill'));
        $before = $this->sheet();

        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::GuestsManage);
        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::StaffRead);
        $after = $this->sheet();

        self::assertNull($after['allergic']);
        foreach (['Main', 'Dessert'] as $name) {
            self::assertSame(self::course($before, $name)['stations'], self::course($after, $name)['stations'], $name);
        }
    }

    #[Test]
    public function openingTheSheetChangesNeitherWhatEachStationServesNorTheWalkingOrder(): void
    {
        $this->picked();
        $this->dishAt($this->main, 'Chicken', $this->addPlace('Grill'));
        $this->dishAt($this->main, 'Plantain', $this->place('Kitchen'));
        $before = $this->staffStations();

        $this->sheet();

        self::assertSame($before, $this->staffStations());
    }

    #[Test]
    public function thePdfCarriesByStationAsHeadingsAndLists(): void
    {
        $this->picked();
        $this->dishAt($this->main, 'Chicken', $this->addPlace('Grill'));
        self::service(ScriptedPdfMaker::class)->answer('%PDF-1.7');

        $this->as('POST', $this->sheetPath() . '/pdf');
        self::assertSame(200, $this->statusCode());
        $html = self::service(ScriptedPdfMaker::class)->html ?? self::fail('no html');

        self::assertCount(3, Str\split($html, '<h3>By station</h3>'), 'the Main and the Dessert, not the Starter');
        self::assertStringContainsString('<div class="station"><h4>Grill</h4><ul><li>Chicken<span class="sep"> · </span><span class="n">1</span></li></ul></div>', $html);
        self::assertStringContainsString('<li class="chefs">Chef’s choice<span class="sep"> · </span><span class="n">2</span></li>', $html);
    }

    /** The real WeasyPrint, and veraPDF's PDF/UA-1 profile (ISO 14289-1) on a sheet carrying By station. */
    #[Test]
    public function aSheetWithByStationPassesVeraPdfsPdfUa1Profile(): void
    {
        $this->picked();
        $this->dishAt($this->main, 'Chicken', $this->addPlace('Grill'));
        $this->dishAt($this->main, 'Jollof rice', $this->place('Kitchen'));

        $this->as('POST', $this->sheetPath() . '/pdf');
        self::assertSame(200, $this->statusCode(), (string) $this->client->getResponse()->getContent());
        $file = Filesystem\create_temporary_file(null, 'kitchen') . '.pdf';
        File\write($file, (string) $this->client->getResponse()->getContent());

        try {
            $report = Shell\execute('verapdf', ['--flavour', 'ua1', '--format', 'xml', $file]);
        } catch (Shell\Exception\FailedExecutionException $failed) {
            $report = $failed->getOutput();
        } finally {
            Filesystem\delete_file($file);
        }

        self::assertStringContainsString('isCompliant="true"', $report, $report);
    }

    /** Seven coming. The Main: Bisi Jollof rice, Chidi Coconut rice with Chicken and Plantain, Ada Coconut rice with Beef and Moi moi, Kojo the egusi, Emeka skipped, Funke Kitchen's choice, Gbenga nothing yet. The Dessert: Bisi Zobo sorbet with two toppings, Chidi Zobo sorbet with None for me, Ada Chin chin, Kojo skipped, the rest nothing yet. */
    private function picked(): void
    {
        $token = $this->coming([['fullName' => 'Chidi Okonkwo'], ['fullName' => 'Ada Obi'], ['fullName' => 'Kojo Asante'], ['fullName' => 'Emeka Eze'], ['fullName' => 'Funke Ade'], ['fullName' => 'Gbenga Ola']]);
        [$bisi, $chidi, $ada, $kojo, $emeka, $funke] = Vec\map(['Bisi Adewale', 'Chidi Okonkwo', 'Ada Obi', 'Kojo Asante', 'Emeka Eze', 'Funke Ade'], $this->personId(...));
        [$main, $dessert] = [$this->id($this->main), $this->id($this->dessert)];
        $this->meals($token, [
            ['person' => $bisi, 'course' => $main, 'answer' => 'chosen', 'dish' => $this->ids['jollof']],
            ['person' => $chidi, 'course' => $main, 'answer' => 'chosen', 'dish' => $this->ids['coconut'], 'variant' => $this->ids['chicken'], 'options' => [$this->ids['plantain']]],
            ['person' => $ada, 'course' => $main, 'answer' => 'chosen', 'dish' => $this->ids['coconut'], 'variant' => $this->ids['beef'], 'options' => [$this->ids['moimoi']]],
            ['person' => $kojo, 'course' => $main, 'answer' => 'chosen', 'dish' => $this->ids['egusi']],
            ['person' => $emeka, 'course' => $main, 'answer' => 'skipped'],
            ['person' => $funke, 'course' => $main, 'answer' => 'chefsChoice'],
            ['person' => $bisi, 'course' => $dessert, 'answer' => 'chosen', 'dish' => $this->ids['zobo'], 'options' => [$this->ids['fruit'], $this->ids['puff']]],
            ['person' => $chidi, 'course' => $dessert, 'answer' => 'chosen', 'dish' => $this->ids['zobo'], 'options' => []],
            ['person' => $ada, 'course' => $dessert, 'answer' => 'chosen', 'dish' => $this->ids['chinchin']],
            ['person' => $kojo, 'course' => $dessert, 'answer' => 'skipped'],
        ]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /**
     * @param array<string, mixed> $sheet
     *
     * @return list<array{string, list<array{string, int, bool}>}>
     */
    private static function stations(array $sheet, string $course): array
    {
        $stations = Type\vec(Type\shape([
            'id' => Type\string(),
            'name' => Type\string(),
            'lines' => Type\vec(Type\shape(['name' => Type\string(), 'count' => Type\int(), 'chefs' => Type\bool()])),
        ]))->coerce(self::course($sheet, $course)['stations']);

        return Vec\map($stations, static fn (array $one): array => [$one['name'], Vec\map($one['lines'], static fn (array $line): array => [$line['name'], $line['count'], $line['chefs']])]);
    }

    /** @return list<array{string, ?int}> each place by name with its walking position */
    private function staffStations(): array
    {
        self::em()->clear();
        $event = self::em()->find(Event::class, Uuid::fromString($this->eventId)) ?? self::fail('no event');

        return Vec\map(self::service(StaffStationRepository::class)->findPlaces($event), static fn (StaffStation $one): array => [$one->getName(), $one->getWalkPosition()]);
    }

    /** @param array<string, mixed> $sheet */
    private function assertSameAsSeePicks(array $sheet): void
    {
        $this->as('GET', '/api/events/' . $this->eventId . '/menu/picks');
        $picks = Type\shape(['picks' => Type\mixed_dict()], true)->coerce($this->last())['picks'];

        foreach (self::courses($picks) as $at => $seen) {
            $course = self::courses($sheet)[$at];
            $rows = Type\vec(Type\shape(['id' => Type\string(), 'chosen' => Type\int(), 'defaulted' => Type\int()], true))->coerce($seen['rows']);
            self::assertSame(Vec\map($rows, static fn (array $row): array => [$row['id'], $row['chosen'] + $row['defaulted']]), Vec\map(Type\vec(Type\shape(['id' => Type\string(), 'count' => Type\int()], true))->coerce($course['rows']), static fn (array $row): array => [$row['id'], $row['count']]));
            foreach (['kitchen', 'skipped', 'needsHost', 'notChosen', 'room'] as $state) {
                self::assertSame($seen[$state], $course[$state], $state);
            }
        }
    }

    private function addPlace(string $name): string
    {
        $this->as('POST', '/api/events/' . $this->eventId . '/stations/places', ['name' => $name]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));

        return $this->place($name);
    }

    private function place(string $name): string
    {
        $event = self::em()->find(Event::class, Uuid::fromString($this->eventId)) ?? self::fail('no event');
        $place = Iter\search(self::service(StaffStationRepository::class)->findPlaces($event), static fn (StaffStation $one): bool => $one->getName() === $name) ?? self::fail('no place ' . $name);

        return $place->getId()->toRfc4122();
    }

    private function dishAt(MenuCourse $course, string $item, string $place): void
    {
        $this->as('PUT', '/api/events/' . $this->eventId . '/stations/courses/' . $this->id($course) . '/dished-at', ['item' => $item, 'place' => $place]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    /** @return array<string, mixed> */
    private function sheet(): array
    {
        $this->as('GET', $this->sheetPath());
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return Type\shape(['sheet' => Type\dict(Type\string(), Type\mixed())], true)->coerce($this->last())['sheet'];
    }

    private function sheetPath(): string
    {
        return '/api/events/' . $this->eventId . '/menu/kitchen-sheet';
    }

    /** @return list<array<string, mixed>> */
    private static function courses(mixed $sheet): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\mixed_dict()->coerce($sheet)['courses'] ?? null);
    }

    /** @return array<string, mixed> */
    private static function course(mixed $sheet, string $name): array
    {
        return Iter\search(self::courses($sheet), static fn (array $course): bool => $name === ($course['name'] ?? null)) ?? self::fail('no course ' . $name);
    }

    private function id(MenuCourse $row): string
    {
        return $row->getId()->toRfc4122();
    }

    /** @param list<array{fullName: ?string}> $companions */
    private function coming(array $companions): string
    {
        $this->as('POST', '/api/events/' . $this->eventId . '/guests', ['fullName' => 'Bisi Adewale', 'companions' => Vec\map($companions, static fn (array $one): array => ['fullName' => $one['fullName']])]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $guestId = Type\shape(['id' => Type\string()], true)->coerce($this->last()['guest'] ?? null)['id'];
        $this->as('GET', '/api/events/' . $this->eventId . '/guests/' . $guestId . '/link');
        $token = Str\after(Type\string()->coerce($this->last()['url'] ?? null), '/i/') ?? self::fail('no token');
        $this->anonymous('/api/guest-links/page', ['token' => $token]);
        $listed = Type\vec(Type\shape(['id' => Type\string()], true))->coerce(Type\mixed_dict()->coerce($this->last()['guest'] ?? null)['companions'] ?? []);
        $this->anonymous('/api/guest-links/reply', [
            'token' => $token,
            'answer' => 'coming',
            'needs' => ['allergies' => []],
            'companions' => Vec\map_with_key($listed, static fn (int $at, array $companion): array => ['id' => $companion['id'], 'fullName' => $companions[$at]['fullName'], 'coming' => true]),
        ]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $token;
    }

    private function personId(string $name): string
    {
        return Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT id FROM guests WHERE full_name = :name', ['name' => $name]));
    }

    /** @param list<array<string, mixed>> $picks */
    private function meals(#[SensitiveParameter] string $token, array $picks): void
    {
        $this->anonymous('/api/guest-links/meals', ['token' => $token, 'picks' => $picks]);
    }

    /** @param array<string, mixed> $body */
    private function anonymous(string $path, #[SensitiveParameter] array $body): void
    {
        $this->client->request('POST', $path, server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT_LANGUAGE' => 'en'], content: Json\encode($body));
    }

    private function live(Organisation $organisation): string
    {
        $this->as('POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/events', ['name' => "Amara & Tobi's wedding", 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-15T02:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN']);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $id = Type\shape(['id' => Type\string()], true)->coerce($this->last()['event'] ?? null)['id'];
        self::service(Connection::class)->executeStatement('UPDATE events SET hosts = :hosts WHERE id = :id', ['hosts' => '["Funmi Adeyemi"]', 'id' => $id]);
        $this->as('POST', '/api/events/' . $id . '/make-live');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $id;
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    /** @param array<string, mixed>|null $body */
    private function as(string $method, string $path, ?array $body = null): void
    {
        $who = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => 'en',
        ], content: null === $body ? null : Json\encode($body));
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw || !Str\starts_with($raw, '{') ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
