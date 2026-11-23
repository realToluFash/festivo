<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MealAnswer;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\MenuDishVariant;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\NeedKind;
use App\Enum\Permission;
use App\Tests\ApiTestCase;
use App\Tests\Double\WithholdingMembershipDirectory;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

/** See picks (sc-3909): every person coming in one state per course, and the host choosing for a guest. */
final class MenuPicksTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private string $eventId;

    private MenuCourse $starter;

    private MenuDishVariant $fullBowl;

    private MenuDishVariant $childrensBowl;

    private MenuCourse $main;

    private MenuDish $jollof;

    private MenuDish $egusi;

    private MenuDish $stew;

    private MenuDishVariant $kidsPlate;

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
        $this->starter = new MenuCourse($event, 'Starter', null, 0);
        $this->starter->setGuestsChoose(false);
        $soup = new MenuDish($this->starter, null, 'Catfish pepper soup', null, ['fish', 'celery'], [], 0);
        $this->fullBowl = new MenuDishVariant($soup, 'Full bowl', false, ['fish', 'celery'], [], null, 0);
        $this->childrensBowl = new MenuDishVariant($soup, "Children's portion", true, ['fish'], [], null, 1);
        $this->main = new MenuCourse($event, 'Main', null, 1);
        $this->main->setSkippable(true);
        $this->jollof = new MenuDish($this->main, null, 'Jollof rice', null, ['celery'], [], 0);
        $this->egusi = new MenuDish($this->main, null, 'Pounded yam and egusi', null, ['milk', 'fish'], [], 1);
        $this->stew = new MenuDish($this->main, null, 'Rice and stew', null, [], [], 2);
        $plate = new MenuDishVariant($this->stew, 'Plate', false, [], [], null, 0);
        $this->kidsPlate = new MenuDishVariant($this->stew, 'Kids plate', true, ['milk'], [], null, 1);

        foreach ([$this->starter, $soup, $this->fullBowl, $this->childrensBowl, $this->main, $this->jollof, $this->egusi, $this->stew, $plate, $this->kidsPlate] as $row) {
            self::em()->persist($row);
        }

        self::em()->flush();
    }

    #[Test]
    public function everyCourseAddsUpToTheRoomInEveryState(): void
    {
        $token = $this->coming([['fullName' => 'Chidi Okonkwo'], ['fullName' => 'Ada Obi'], ['fullName' => 'Kojo Asante']]);
        [$bisi, $chidi, $ada, $kojo] = [$this->personId('Bisi Adewale'), $this->personId('Chidi Okonkwo'), $this->personId('Ada Obi'), $this->personId('Kojo Asante')];
        $this->hostRecords($chidi, ['celery']);
        $main = self::em()->find(MenuCourse::class, $this->main->getId()) ?? self::fail('no main');
        $suya = new MenuDish($main, null, 'Suya', null, null, [], 3);
        $ofada = new MenuDish($main, null, 'Ofada stew', null, null, [], 4);
        $ofadaPlate = new MenuDishVariant($ofada, 'Plate', false, ['peanuts'], [], null, 0);

        foreach ([$suya, $ofada, $ofadaPlate] as $row) {
            self::em()->persist($row);
        }

        self::em()->flush();
        $this->meals($token, [
            ['person' => $bisi, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->jollof)],
            ['person' => $chidi, 'course' => $this->id($this->main), 'answer' => 'chefsChoice'],
            ['person' => $ada, 'course' => $this->id($this->main), 'answer' => 'skipped'],
        ]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $picks = $this->picks();

        self::assertSame(4, $picks['room']);
        self::assertSame(0, $picks['held']);
        self::assertSame(3, $picks['answered']);
        self::assertSame(75, $picks['percent']);
        self::assertFalse($picks['allIn']);

        foreach (self::courses($picks) as $course) {
            self::assertSame(4, self::sum($course), $course['name']);
        }

        $starter = self::course($picks, 'Starter');
        self::assertTrue($starter['asksNothing']);
        self::assertSame(3, self::row($starter, 'Full bowl')['chosen']);
        self::assertSame(1, $starter['needsHost']);

        $main = self::course($picks, 'Main');
        self::assertSame([1, 1, 1, 1], [self::row($main, 'Jollof rice')['chosen'], $main['kitchen'], $main['skipped'], $main['notChosen']]);
        self::assertSame([['fish', 'celery'], ['milk', 'fish'], [], null, []], [self::row($starter, 'Catfish pepper soup')['allergens'], self::row($main, 'Pounded yam and egusi')['allergens'], self::row($main, 'Rice and stew')['allergens'], self::row($main, 'Suya')['allergens'], self::row($main, 'Ofada stew')['allergens']]);
        self::assertSame([['person' => ['id' => $chidi, 'name' => 'Chidi Okonkwo'], 'course' => $this->id($this->starter), 'reason' => 'nothing', 'pick' => null, 'allergens' => [], 'notStated' => false]], $picks['needsHost']);
        self::assertSame([['id' => $bisi, 'replier' => 'Bisi Adewale', 'people' => [['id' => $kojo, 'name' => 'Kojo Asante', 'courses' => [$this->id($this->main)], 'excluded' => []]]]], $picks['waiting']);
    }

    #[Test]
    public function unnamedHeldPlacesAreCountedApartFromTheRoom(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo'], ['fullName' => null]]);

        $picks = $this->picks();

        self::assertSame(2, $picks['room']);
        self::assertSame(1, $picks['held']);
    }

    #[Test]
    public function aPlateTheRecordRulesOutIsSavedOnlyOnceConfirmedAndNamesTheHost(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $chidi = $this->personId('Chidi Okonkwo');
        $this->hostRecords($chidi, ['celery']);

        $this->chooseFor($chidi, $this->main, ['answer' => 'chosen', 'dish' => $this->id($this->jollof)]);
        self::assertSame(409, $this->statusCode(), Json\encode($this->last()));
        self::assertSame('https://soirely.com/errors/meal_pick_ruled_out', $this->last()['type'] ?? null);
        self::assertSame([], self::em()->getRepository(MealAnswer::class)->findAll());

        $this->chooseFor($chidi, $this->main, ['answer' => 'chosen', 'dish' => $this->id($this->jollof), 'anyway' => true]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $answer = $this->answerOf($chidi, $this->main);
        self::assertSame($this->owner->getId()->toRfc4122(), $answer->getChosenBy()?->getId()->toRfc4122());
        self::assertNotNull($answer->getChosenAt());
        self::assertSame(['celery'], $answer->getOverridden());
        self::assertSame(1, self::row(self::course($this->last()['picks'] ?? null, 'Main'), 'Jollof rice')['chosen']);
    }

    #[Test]
    public function theHostStillChoosesForAGuestOnACoursePastItsClose(): void
    {
        $token = $this->coming([]);
        $bisi = $this->personId('Bisi Adewale');
        self::mockTime(new DateTimeImmutable('2030-11-14T16:30:00+01:00'));

        $this->meals($token, [['person' => $bisi, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->egusi)]]);
        self::assertSame(409, $this->statusCode());

        $this->chooseFor($bisi, $this->main, ['answer' => 'chosen', 'dish' => $this->id($this->egusi)]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame($this->id($this->egusi), $this->answerOf($bisi, $this->main)->getDish()?->getId()->toRfc4122());
    }

    #[Test]
    public function aPickCountsUnderNeedsTheHostWhileAnAllergyItContainsIsRecorded(): void
    {
        $token = $this->coming([]);
        $bisi = $this->personId('Bisi Adewale');
        $this->meals($token, [['person' => $bisi, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->egusi)]]);

        $this->hostRecords($bisi, ['milk']);
        $main = self::course($this->picks(), 'Main');
        self::assertSame([0, 1], [self::row($main, 'Pounded yam and egusi')['chosen'], $main['needsHost']]);
        self::assertSame([['person' => ['id' => $bisi, 'name' => 'Bisi Adewale'], 'course' => $this->id($this->main), 'reason' => 'allergy', 'pick' => 'Pounded yam and egusi', 'allergens' => ['milk'], 'notStated' => false]], $this->picks()['needsHost']);

        $this->hostRecords($bisi, []);
        $main = self::course($this->picks(), 'Main');
        self::assertSame([1, 0], [self::row($main, 'Pounded yam and egusi')['chosen'], $main['needsHost']]);
    }

    #[Test]
    public function aPickThatNeverStatedItsAllergensSaysSoUnderNeedsTheHost(): void
    {
        $token = $this->coming([]);
        $bisi = $this->personId('Bisi Adewale');
        $main = self::em()->find(MenuCourse::class, $this->main->getId()) ?? self::fail('no main');
        $suya = new MenuDish($main, null, 'Suya', null, null, [], 3);
        self::em()->persist($suya);
        self::em()->flush();
        $this->meals($token, [['person' => $bisi, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($suya)]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->hostRecords($bisi, ['peanuts']);

        self::assertSame([['person' => ['id' => $bisi, 'name' => 'Bisi Adewale'], 'course' => $this->id($this->main), 'reason' => 'allergy', 'pick' => 'Suya', 'allergens' => ['peanuts'], 'notStated' => true]], $this->picks()['needsHost']);
    }

    #[Test]
    public function onACourseThatAsksNothingARuledOutPersonNeedsTheHostUntilChosenForOrTheAllergyGoes(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo'], ['fullName' => 'Ada Obi']]);
        [$chidi, $ada] = [$this->personId('Chidi Okonkwo'), $this->personId('Ada Obi')];
        $this->hostRecords($chidi, ['fish']);
        $this->hostRecords($ada, ['celery']);

        $starter = self::course($this->picks(), 'Starter');
        self::assertSame([1, 2], [self::row($starter, 'Catfish pepper soup')['chosen'], $starter['needsHost']]);
        self::assertSame(3, self::sum($starter));
        self::assertFalse($this->picks()['allIn']);

        $this->chooseFor($chidi, $this->starter, ['answer' => 'chosen', 'dish' => $this->id($this->starter, 0), 'variant' => $this->fullBowl->getId()->toRfc4122(), 'anyway' => true]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->hostRecords($ada, []);

        $starter = self::course($this->picks(), 'Starter');
        self::assertSame([3, 3, 0], [self::row($starter, 'Catfish pepper soup')['chosen'], self::row($starter, 'Full bowl')['chosen'], $starter['needsHost']]);
        self::assertSame(3, self::sum($starter));
    }

    #[Test]
    public function chooseWhoGetsItGivesAChildrenOnlyVariantAndTakesItBack(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo'], ['fullName' => 'Ada Obi']]);
        [$chidi, $ada] = [$this->personId('Chidi Okonkwo'), $this->personId('Ada Obi')];
        $this->hostRecords($ada, ['milk']);

        $this->giveVariant($this->childrensBowl, [$chidi]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $starter = self::course($this->picks(), 'Starter');
        self::assertSame([2, 1], [self::row($starter, 'Full bowl')['chosen'], self::row($starter, "Children's portion")['chosen']]);
        self::assertSame([$chidi], self::row($starter, "Children's portion")['holders']);
        self::assertSame($this->owner->getId()->toRfc4122(), $this->answerOf($chidi, $this->starter)->getChosenBy()?->getId()->toRfc4122());

        $this->giveVariant($this->childrensBowl, []);
        $starter = self::course($this->picks(), 'Starter');
        self::assertSame([3, 0], [self::row($starter, 'Full bowl')['chosen'], self::row($starter, "Children's portion")['chosen']]);

        $this->giveVariant($this->kidsPlate, [$chidi, $ada]);
        self::assertSame(409, $this->statusCode(), Json\encode($this->last()));
        self::assertSame([['id' => $ada, 'allergens' => ['milk']]], Type\mixed_dict()->coerce($this->last())['people'] ?? null);

        $this->giveVariant($this->kidsPlate, [$chidi, $ada], anyway: true);
        $main = self::course($this->picks(), 'Main');
        self::assertSame([2, 2, 1], [self::row($main, 'Kids plate')['chosen'], self::row($main, 'Rice and stew')['chosen'], $main['notChosen']]);
        self::assertSame(['milk'], $this->answerOf($ada, $this->main)->getOverridden());

        $this->giveVariant($this->kidsPlate, [$ada]);
        $main = self::course($this->picks(), 'Main');
        self::assertSame([1, 2], [self::row($main, 'Kids plate')['chosen'], $main['notChosen']]);
    }

    #[Test]
    public function choosingNeedsGuestsManageAndNamesNeedGuestsRead(): void
    {
        $this->coming([['fullName' => 'Chidi Okonkwo']]);
        $bisi = $this->personId('Bisi Adewale');
        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::GuestsManage);

        self::assertFalse($this->picks()['canChoose']);
        $this->chooseFor($bisi, $this->main, ['answer' => 'chefsChoice']);
        self::assertSame(403, $this->statusCode());
        $this->giveVariant($this->kidsPlate, [$bisi]);
        self::assertSame(403, $this->statusCode());

        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::GuestsRead);
        $picks = $this->picks();
        self::assertSame(2, $picks['room']);
        self::assertNull($picks['waiting']);
        self::assertNull($picks['people']);
        self::assertNull($picks['needsHost']);
        self::assertSame(2, self::course($picks, 'Main')['notChosen']);
    }

    #[Test]
    public function anEventWithCoursesAndNobodyComingHasAnEmptyRoom(): void
    {
        $picks = $this->picks();

        self::assertSame([0, 0, 0], [$picks['room'], $picks['held'], $picks['answered']]);

        foreach (self::courses($picks) as $course) {
            self::assertSame([0, 0, 0], [self::sum($course), $course['needsHost'], $course['notChosen']], $course['name']);
        }
    }

    #[Test]
    public function seePicksNeedsMenuRead(): void
    {
        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::MenuRead);

        $this->as('GET', '/api/events/' . $this->eventId . '/menu/picks');

        self::assertSame(403, $this->statusCode());
    }

    /** @return array<string, mixed> */
    private function picks(): array
    {
        $this->as('GET', '/api/events/' . $this->eventId . '/menu/picks');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return Type\dict(Type\string(), Type\mixed())->coerce($this->last()['picks'] ?? null);
    }

    /** @param array<string, mixed> $body */
    private function chooseFor(string $person, MenuCourse $course, array $body): void
    {
        $this->as('PUT', '/api/events/' . $this->eventId . '/menu/picks/people/' . $person . '/courses/' . $this->id($course), $body);
    }

    /** @param list<string> $people */
    private function giveVariant(MenuDishVariant $variant, array $people, bool $anyway = false): void
    {
        $this->as('PUT', '/api/events/' . $this->eventId . '/menu/picks/variants/' . $variant->getId()->toRfc4122(), ['people' => $people, 'anyway' => $anyway]);
    }

    /** @return list<array<string, mixed>> */
    private static function courses(mixed $picks): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\mixed_dict()->coerce($picks)['courses'] ?? null);
    }

    /** @return array<string, mixed> */
    private static function course(mixed $picks, string $name): array
    {
        return Iter\search(self::courses($picks), static fn (array $course): bool => $name === ($course['name'] ?? null)) ?? self::fail('no course ' . $name);
    }

    /** @return array<string, mixed> */
    private static function row(mixed $course, string $name): array
    {
        $rows = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\mixed_dict()->coerce($course)['rows'] ?? null);

        return Iter\search($rows, static fn (array $row): bool => $name === ($row['name'] ?? null)) ?? self::fail('no row ' . $name);
    }

    /** @param array<string, mixed> $course */
    private static function sum(array $course): int
    {
        $dishes = Vec\filter(Type\vec(Type\mixed_dict())->coerce($course['rows'] ?? null), static fn (array $row): bool => 'dish' === ($row['kind'] ?? null));
        $states = Vec\map(['kitchen', 'skipped', 'needsHost', 'notChosen'], static fn (string $key): int => Type\int()->coerce($course[$key] ?? null));

        return Iter\reduce(Vec\map($dishes, static fn (array $row): int => Type\int()->coerce($row['chosen'] ?? null) + Type\int()->coerce($row['defaulted'] ?? null)), static fn (int $sum, int $n): int => $sum + $n, 0) + Iter\reduce($states, static fn (int $sum, int $n): int => $sum + $n, 0);
    }

    private function id(MenuCourse|MenuDish $row, ?int $dish = null): string
    {
        if (null === $dish) {
            return $row->getId()->toRfc4122();
        }

        return Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT id FROM menu_dishes WHERE course_id = :course ORDER BY position LIMIT 1 OFFSET ' . $dish, ['course' => $row->getId()->toRfc4122()]));
    }

    private function answerOf(string $person, MenuCourse $course): MealAnswer
    {
        self::em()->clear();

        return self::em()->getRepository(MealAnswer::class)->findOneBy(['person' => Uuid::fromString($person), 'course' => $course->getId()]) ?? self::fail('no answer');
    }

    /** @param list<array{fullName: ?string}> $companions */
    private function coming(array $companions): string
    {
        $this->as('POST', $this->guests(), ['fullName' => 'Bisi Adewale', 'companions' => Vec\map($companions, static fn (array $one): array => ['fullName' => $one['fullName']])]);
        self::assertSame(201, $this->statusCode(), Json\encode($this->last()));
        $guestId = Type\shape(['id' => Type\string()], true)->coerce($this->last()['guest'] ?? null)['id'];
        $this->as('GET', $this->guests() . '/' . $guestId . '/link');
        $token = Str\after(Type\string()->coerce($this->last()['url'] ?? null), '/i/') ?? self::fail('no token');
        $this->anonymous('/api/guest-links/page', ['token' => $token]);
        $page = $this->last();
        $listed = Type\vec(Type\shape(['id' => Type\string()], true))->coerce(Type\mixed_dict()->coerce($page['guest'] ?? null)['companions'] ?? []);
        $this->anonymous('/api/guest-links/reply', [
            'token' => $token,
            'answer' => 'coming',
            'needs' => ['allergies' => []],
            'companions' => Vec\map_with_key($listed, static fn (int $at, array $companion): array => ['id' => $companion['id'], ...(null === ($companions[$at]['fullName'] ?? null) ? [] : ['fullName' => $companions[$at]['fullName']]), 'coming' => true]),
        ]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $token;
    }

    private function personId(string $name): string
    {
        return Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT id FROM guests WHERE full_name = :name', ['name' => $name]));
    }

    /** @param list<string> $allergies */
    private function hostRecords(string $guestId, array $allergies): void
    {
        $person = self::em()->find(Guest::class, Uuid::fromString($guestId)) ?? self::fail('no guest');
        $needs = GuestNeeds::none();
        self::service(GuestNeedsRecord::class)->write($person, new GuestNeeds([...$needs->codes, NeedKind::Allergen->value => $allergies], $needs->others, null), $this->owner);
        self::em()->flush();
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

    private function guests(): string
    {
        return '/api/events/' . $this->eventId . '/guests';
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

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
