<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Dish;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MealAnswer;
use App\Entity\Membership;
use App\Entity\MenuDish;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MealAnswerKind;
use App\Enum\MembershipStatus;
use App\Enum\NeedKind;
use App\Enum\Permission;
use App\Enum\RealtimeTopic;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\Messaging\RecordingHub;
use App\Tests\Double\WithholdingMembershipDirectory;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use App\Tests\Traits\StoresMealAnswers;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** An event's menu: its courses in order, the dishes on each as the event's own copies, and who may change it (sc-3902). */
final class EventMenuTest extends ApiTestCase
{
    use OnboardsAccounts;
    use PutsPeopleOnEvents;
    use StoresMealAnswers;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private Organisation $organisation;

    private string $eventId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        $this->owner = $this->account('owner@ire.events', 'Ifeoma Nduka');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent();
    }

    #[Test]
    public function coursesKeepTheOrderTheyWereAddedInWithTheirServedTimes(): void
    {
        $this->course('Starter', '18:30');
        $this->course('  Main ', '8:05');
        $this->course('Dessert', null);

        self::assertSame([['Starter', '18:30'], ['Main', '08:05'], ['Dessert', null]], Vec\map($this->courses(), static fn (array $course): array => [$course['name'], $course['servedAt']]));
    }

    /** @return iterable<string, array{array<string, mixed>, string, string}> */
    public static function refusedCourses(): iterable
    {
        yield 'a blank name' => [['name' => '   '], 'name', 'validation.course_name_required'];
        yield 'a name over 60' => [['name' => Str\repeat('a', 61)], 'name', 'validation.course_name_too_long'];
        yield 'a time that is not 24-hour' => [['name' => 'Main', 'servedAt' => '8pm'], 'servedAt', 'validation.course_served_invalid'];
        yield 'an hour past 23' => [['name' => 'Main', 'servedAt' => '24:00'], 'servedAt', 'validation.course_served_invalid'];
    }

    /** @param array<string, mixed> $body */
    #[Test]
    #[DataProvider('refusedCourses')]
    public function aWrongCourseIsRefusedBesideTheFieldAndNothingIsAdded(array $body, string $field, string $key): void
    {
        $this->as($this->owner, 'POST', $this->path('/courses'), $body);

        self::assertSame(422, $this->statusCode());
        self::assertSame(self::service(TranslatorInterface::class)->trans($key, ['{max}' => '60'], null, 'en'), $this->violation($field));
        self::assertSame([], $this->courses());
    }

    #[Test]
    public function sixtyCharactersIsAllowed(): void
    {
        self::assertSame(Str\repeat('a', 60), $this->course(Str\repeat('a', 60))['name']);
    }

    #[Test]
    public function theEleventhCourseIsRefused(): void
    {
        foreach (Vec\range(1, 10) as $n) {
            $this->course('Course ' . $n);
        }

        $this->as($this->owner, 'POST', $this->path('/courses'), ['name' => 'Petits fours']);

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/menu_course_limit', $this->last()['type'] ?? null);
        self::assertSame('A menu can have at most 10 courses.', $this->last()['detail'] ?? null);
        self::assertCount(10, $this->courses());
    }

    #[Test]
    public function aCourseMovesToItsNewPlaceAndTheOthersCloseUp(): void
    {
        $starter = $this->course('Starter');
        $main = $this->course('Main');
        $this->course('Dessert');

        $this->as($this->owner, 'POST', $this->path('/courses/' . $main['id'] . '/move'), ['to' => 0]);
        self::assertSame(200, $this->statusCode());
        self::assertSame(['Main', 'Starter', 'Dessert'], $this->names());

        $this->as($this->owner, 'POST', $this->path('/courses/' . $starter['id'] . '/move'), ['to' => 9]);
        self::assertSame(['Main', 'Dessert', 'Starter'], $this->names());
    }

    #[Test]
    public function deletingACourseTakesItsDishesAndClosesTheGap(): void
    {
        $this->course('Starter');
        $main = $this->course('Main');
        $dessert = $this->course('Dessert');
        $this->newDish($main['id'], ['name' => 'Asun', 'containsNone' => true, 'onlyForEvent' => true]);

        $this->as($this->owner, 'DELETE', $this->path('/courses/' . $main['id']));
        self::assertSame(200, $this->statusCode());
        self::assertSame(['Starter', 'Dessert'], $this->names());
        self::assertSame(0, self::em()->getRepository(MenuDish::class)->count([]));

        $this->as($this->owner, 'POST', $this->path('/courses/' . $dessert['id'] . '/move'), ['to' => 0]);
        self::assertSame(['Dessert', 'Starter'], $this->names());
    }

    #[Test]
    public function aCourseGuestsHavePickedFromCannotBeDeleted(): void
    {
        $main = $this->course('Main');
        $jollof = $this->newDish($main['id'], ['name' => 'Jollof rice', 'allergens' => ['celery'], 'onlyForEvent' => true]);
        $this->picks($jollof['id'], $this->guest('Tolu Adeyemi', []));

        $this->as($this->owner, 'DELETE', $this->path('/courses/' . $main['id']));

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/menu_course_picked', $this->last()['type'] ?? null);
        self::assertSame(['Main'], $this->names());
    }

    #[Test]
    public function addingFromTheLibraryCopiesTheDishAndLaterLibraryEditsChangeNothingHere(): void
    {
        $main = $this->course('Main');
        $library = $this->libraryDish('Jollof rice', ['celery'], 'halal');

        $added = $this->as($this->owner, 'POST', $this->path('/courses/' . $main['id'] . '/dishes'), ['libraryDishId' => $library->getId()->toRfc4122()]);
        self::assertSame(201, $this->statusCode(), Json\encode($added));

        $this->as($this->owner, 'PUT', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/dishes/' . $library->getId()->toRfc4122(), ['name' => 'Smoky jollof', 'allergens' => ['celery', 'sesame']]);
        self::assertSame(200, $this->statusCode());

        $dish = $this->dishes($this->courses()[0])[0];
        self::assertSame('Jollof rice', $dish['name']);
        self::assertSame(['celery'], $dish['allergens']);
        self::assertSame(['halal'], $dish['diets']);
        self::assertSame($library->getId()->toRfc4122(), $dish['libraryDishId']);
        self::assertTrue(self::em()->find(Dish::class, $library->getId())?->isUsedByEvent());
    }

    #[Test]
    public function aSecondCopyOfALibraryDishOnOneCourseIsRefusedEvenAfterTheCopyIsEdited(): void
    {
        $main = $this->course('Main');
        $library = $this->libraryDish('Jollof rice', ['celery']);
        $this->as($this->owner, 'POST', $this->path('/courses/' . $main['id'] . '/dishes'), ['libraryDishId' => $library->getId()->toRfc4122()]);
        $copy = $this->dishes($this->courses()[0])[0];
        $this->as($this->owner, 'PUT', $this->path('/dishes/' . $copy['id']), ['name' => 'Party jollof', 'allergens' => ['celery']]);

        $this->as($this->owner, 'POST', $this->path('/courses/' . $main['id'] . '/dishes'), ['libraryDishId' => $library->getId()->toRfc4122()]);

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/menu_dish_on_course', $this->last()['type'] ?? null);
        self::assertSame(['Party jollof'], Vec\map($this->dishes($this->courses()[0]), static fn (array $dish): string => $dish['name']));
    }

    #[Test]
    public function theSameLibraryDishMayBeOnAnotherCourseAndAgainOnceItsCopyIsRemoved(): void
    {
        $starter = $this->course('Starter');
        $main = $this->course('Main');
        $library = $this->libraryDish('Jollof rice', ['celery']);
        $this->as($this->owner, 'POST', $this->path('/courses/' . $starter['id'] . '/dishes'), ['libraryDishId' => $library->getId()->toRfc4122()]);

        $this->as($this->owner, 'POST', $this->path('/courses/' . $main['id'] . '/dishes'), ['libraryDishId' => $library->getId()->toRfc4122()]);
        self::assertSame(201, $this->statusCode());

        $this->as($this->owner, 'DELETE', $this->path('/dishes/' . $this->dishes($this->courses()[0])[0]['id']));
        self::assertSame(200, $this->statusCode());
        $this->as($this->owner, 'POST', $this->path('/courses/' . $starter['id'] . '/dishes'), ['libraryDishId' => $library->getId()->toRfc4122()]);
        self::assertSame(201, $this->statusCode());

        self::assertSame([['Jollof rice'], ['Jollof rice']], Vec\map($this->courses(), fn (array $course): array => Vec\map($this->dishes($course), static fn (array $dish): string => $dish['name'])));
    }

    #[Test]
    public function anArchivedLibraryDishIsNotFoundAndNothingIsAdded(): void
    {
        $main = $this->course('Main');
        $library = $this->libraryDish('Jollof rice', ['celery']);
        $library->setArchivedAt(new DateTimeImmutable('2026-11-01T10:00:00+00:00'));
        self::em()->flush();

        $this->as($this->owner, 'POST', $this->path('/courses/' . $main['id'] . '/dishes'), ['libraryDishId' => $library->getId()->toRfc4122()]);

        self::assertSame(404, $this->statusCode());
        self::assertSame([], $this->dishes($this->courses()[0]));
    }

    #[Test]
    public function editingTheEventsCopyLeavesTheLibraryAsItWas(): void
    {
        $main = $this->course('Main');
        $library = $this->libraryDish('Jollof rice', ['celery']);
        $this->as($this->owner, 'POST', $this->path('/courses/' . $main['id'] . '/dishes'), ['libraryDishId' => $library->getId()->toRfc4122()]);
        $copy = $this->dishes($this->courses()[0])[0];

        $this->as($this->owner, 'PUT', $this->path('/dishes/' . $copy['id']), ['name' => 'Party jollof', 'allergens' => ['celery', 'mustard']]);
        self::assertSame(200, $this->statusCode());

        self::em()->clear();
        $kept = self::em()->find(Dish::class, $library->getId()) ?? self::fail('no dish');
        self::assertSame('Jollof rice', $kept->getName());
        self::assertSame(['celery'], $kept->getAllergens());
        self::assertSame('Party jollof', $this->dishes($this->courses()[0])[0]['name']);
    }

    #[Test]
    public function aNewDishIsAlsoSavedToTheLibraryUnlessOnlyForThisEvent(): void
    {
        $main = $this->course('Main');
        $wrap = $this->newDish($main['id'], ['name' => 'Suya wrap', 'allergens' => ['gluten', 'peanuts', 'sesame'], 'diets' => ['halal']]);
        $asun = $this->newDish($main['id'], ['name' => 'Asun', 'containsNone' => true, 'onlyForEvent' => true]);

        self::assertNotNull($wrap['libraryDishId']);
        self::assertNull($asun['libraryDishId']);
        self::assertSame(['Suya wrap'], Vec\map(self::em()->getRepository(Dish::class)->findBy(['organisation' => $this->organisation->getId()]), static fn (Dish $dish): string => $dish->getName()));
    }

    #[Test]
    public function aNewDishIsRefusedAsTheLibraryRefusesIt(): void
    {
        $main = $this->course('Main');

        $this->as($this->owner, 'POST', $this->path('/courses/' . $main['id'] . '/dishes'), ['name' => 'Asun', 'onlyForEvent' => true]);

        self::assertSame(422, $this->statusCode());
        self::assertSame(self::service(TranslatorInterface::class)->trans('validation.dish_contains_required', [], null, 'en'), $this->violation('allergens'));
        self::assertSame([], $this->dishes($this->courses()[0]));
    }

    #[Test]
    public function everyoneGetsTheSameNeedsExactlyOneDishAndASecondDishPutsItBack(): void
    {
        $starter = $this->course('Starter');
        $this->change($starter['id'], ['answer' => 'same']);
        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/menu_same_one_dish', $this->last()['type'] ?? null);

        $this->newDish($starter['id'], ['name' => 'Pepper soup', 'allergens' => ['fish'], 'onlyForEvent' => true]);
        $this->change($starter['id'], ['answer' => 'same', 'skippable' => true]);
        self::assertSame(200, $this->statusCode());
        self::assertSame('same', $this->courses()[0]['answer']);
        self::assertTrue($this->courses()[0]['skippable']);

        $this->newDish($starter['id'], ['name' => 'Asun', 'containsNone' => true, 'onlyForEvent' => true]);
        self::assertSame('choose', $this->courses()[0]['answer']);
    }

    #[Test]
    public function removingAPickedDishAsksTheHostFirstThenAsksOnlyThoseWhoPickedItForThatCourse(): void
    {
        $starter = $this->course('Starter');
        $suya = $this->newDish($starter['id'], ['name' => 'Suya', 'allergens' => ['peanuts'], 'onlyForEvent' => true]);
        $this->newDish($starter['id'], ['name' => 'Puff puff', 'containsNone' => true, 'onlyForEvent' => true]);
        $main = $this->course('Main');
        $jollof = $this->newDish($main['id'], ['name' => 'Jollof rice', 'allergens' => ['celery'], 'onlyForEvent' => true]);
        $asun = $this->newDish($main['id'], ['name' => 'Asun', 'containsNone' => true, 'onlyForEvent' => true]);
        $tolu = $this->guest('Tolu Adeyemi', []);
        $femi = $this->guest('Femi Ade', []);
        $kemi = $this->guest('Kemi Ade', []);
        $this->picks($jollof['id'], $tolu);
        $this->picks($jollof['id'], $femi);
        $this->picks($asun['id'], $kemi);
        $this->picks($suya['id'], $tolu);

        $this->as($this->owner, 'DELETE', $this->path('/dishes/' . $jollof['id']));
        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::MenuChangeAsks->type(), $this->last()['type'] ?? null);
        self::assertSame([2, ['id' => $main['id'], 'name' => 'Main'], 'picked'], [$this->last()['people'] ?? null, $this->last()['course'] ?? null, $this->last()['whom'] ?? null]);
        self::assertSame(['Jollof rice', 'Asun'], $this->dishNames(1), 'nothing changes until the host confirms');

        $this->as($this->owner, 'DELETE', $this->path('/dishes/' . $jollof['id'] . '?askAgain=1'));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['Asun'], $this->dishNames(1));
        self::assertSame([MealAnswerKind::MenuChanged, 'Jollof rice', null], $this->answered($tolu, 'Main'));
        self::assertSame([MealAnswerKind::MenuChanged, 'Jollof rice', null], $this->answered($femi, 'Main'));
        self::assertSame([MealAnswerKind::Chosen, null, 'Asun'], $this->answered($kemi, 'Main'), 'someone outside the change keeps their answer');
        self::assertSame([MealAnswerKind::Chosen, null, 'Suya'], $this->answered($tolu, 'Starter'), 'only the course it touches is asked again');

        $told = $this->as($this->owner, 'GET', $this->path('/asked-again'));
        self::assertSame(200, $this->statusCode());
        self::assertSame(['Femi Ade', 'Tolu Adeyemi'], Vec\sort(Vec\map(Type\vec(Type\shape(['person' => Type\shape(['name' => Type\string()], true)], true))->coerce($told['people'] ?? null), static fn (array $one): string => $one['person']['name'])));
    }

    #[Test]
    public function removingADishNobodyPickedSavesAtOnce(): void
    {
        $main = $this->course('Main');
        $jollof = $this->newDish($main['id'], ['name' => 'Jollof rice', 'allergens' => ['celery'], 'onlyForEvent' => true]);
        $asun = $this->newDish($main['id'], ['name' => 'Asun', 'containsNone' => true, 'onlyForEvent' => true]);
        $this->picks($jollof['id'], $this->guest('Tolu Adeyemi', []));

        $this->as($this->owner, 'DELETE', $this->path('/dishes/' . $asun['id']));
        self::assertSame(200, $this->statusCode());
        self::assertSame(['Jollof rice'], $this->dishNames(0));
    }

    #[Test]
    public function beforeAnyoneHasPickedAChangeAsksNothing(): void
    {
        $main = $this->course('Main');
        $jollof = $this->newDish($main['id'], ['name' => 'Jollof rice', 'allergens' => ['celery'], 'onlyForEvent' => true]);
        $this->guest('Tolu Adeyemi', ['sesame']);
        $dessert = $this->course('Dessert');

        $this->as($this->owner, 'PUT', $this->path('/dishes/' . $jollof['id']), ['name' => 'Jollof rice', 'allergens' => ['celery', 'sesame']]);
        self::assertSame(200, $this->statusCode());
        $this->newDish($dessert['id'], ['name' => 'Puff puff', 'containsNone' => true, 'onlyForEvent' => true]);
        $this->as($this->owner, 'DELETE', $this->path('/dishes/' . $jollof['id']));
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function aChoosingCoursesFirstDishAsksEveryoneComingOnceAnyoneHasPicked(): void
    {
        $main = $this->course('Main');
        $jollof = $this->newDish($main['id'], ['name' => 'Jollof rice', 'allergens' => ['celery'], 'onlyForEvent' => true]);
        $this->picks($jollof['id'], $this->guest('Tolu Adeyemi', []));
        $this->comes($this->guest('Femi Ade', []));
        self::em()->flush();
        $dessert = $this->course('Dessert');

        $this->as($this->owner, 'POST', $this->path('/courses/' . $dessert['id'] . '/dishes'), ['name' => 'Puff puff', 'containsNone' => true, 'onlyForEvent' => true]);
        self::assertSame(409, $this->statusCode());
        self::assertSame([2, 'Dessert', 'everyone'], [$this->last()['people'] ?? null, Type\shape(['name' => Type\string()], true)->coerce($this->last()['course'] ?? null)['name'], $this->last()['whom'] ?? null]);
        self::assertSame([], $this->dishNames(1));

        $this->as($this->owner, 'POST', $this->path('/courses/' . $dessert['id'] . '/dishes?askAgain=1'), ['name' => 'Puff puff', 'containsNone' => true, 'onlyForEvent' => true]);
        self::assertSame(201, $this->statusCode());
        $this->newDish($dessert['id'], ['name' => 'Chin chin', 'containsNone' => true, 'onlyForEvent' => true]);
        self::assertSame(['Puff puff', 'Chin chin'], $this->dishNames(1), 'a second dish asks nobody');
    }

    #[Test]
    public function anAllergenAddedToAPickedDishAsksAgainOnlyThoseWhoPickedItWithItRecorded(): void
    {
        $jollof = $this->pickedJollof();

        $this->as($this->owner, 'PUT', $this->path('/dishes/' . $jollof), ['name' => 'Jollof rice', 'allergens' => ['celery', 'peanuts', 'sesame', 'mustard']]);
        self::assertSame(409, $this->statusCode());
        self::assertSame([4, 'allergen', ['peanuts', 'sesame']], [$this->last()['people'] ?? null, $this->last()['whom'] ?? null, $this->last()['allergens'] ?? null], 'a person counts once, an Other allergy is never matched');
        self::assertSame(['celery'], $this->dishes($this->courses()[0])[0]['allergens']);

        $this->as($this->owner, 'PUT', $this->path('/dishes/' . $jollof . '?askAgain=1'), ['name' => 'Jollof rice', 'allergens' => ['celery', 'peanuts', 'sesame', 'mustard']]);
        self::assertSame(200, $this->statusCode());
        self::assertSame(['peanuts', 'celery', 'mustard', 'sesame'], $this->dishes($this->courses()[0])[0]['allergens']);
        $kinds = Vec\map(self::em()->getRepository(MealAnswer::class)->findAll(), static fn (MealAnswer $answer): string => $answer->getKind()->value);
        self::assertSame(['chosen' => 2, 'menuChanged' => 4], Dict\sort_by_key(Dict\count_values($kinds)));
    }

    #[Test]
    public function nobodyWithAnAddedAllergenRecordedIsAskedSoItSavesAtOnce(): void
    {
        $jollof = $this->pickedJollof();

        $this->as($this->owner, 'PUT', $this->path('/dishes/' . $jollof), ['name' => 'Jollof rice', 'allergens' => ['celery', 'mustard']]);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function anOtherAllergyIsNeverMatched(): void
    {
        $main = $this->course('Main');
        $jollof = $this->newDish($main['id'], ['name' => 'Jollof rice', 'allergens' => ['celery'], 'onlyForEvent' => true]);
        $this->picks($jollof['id'], $this->guest('Bisi Ola', ['other'], 'sesame'));

        $this->as($this->owner, 'PUT', $this->path('/dishes/' . $jollof['id']), ['name' => 'Jollof rice', 'allergens' => ['celery', 'sesame']]);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function removingAnAllergenOrTickingNoneAsksNobody(): void
    {
        $main = $this->course('Main');
        $jollof = $this->newDish($main['id'], ['name' => 'Jollof rice', 'allergens' => ['celery', 'sesame'], 'onlyForEvent' => true]);
        $this->picks($jollof['id'], $this->guest('Bisi Ola', ['sesame', 'celery']));

        $this->as($this->owner, 'PUT', $this->path('/dishes/' . $jollof['id']), ['name' => 'Jollof rice', 'allergens' => ['celery']]);
        self::assertSame(200, $this->statusCode());
        $this->as($this->owner, 'PUT', $this->path('/dishes/' . $jollof['id']), ['name' => 'Jollof rice', 'containsNone' => true]);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function afterTheEventsDateItsMenuRefusesEveryChange(): void
    {
        $main = $this->course('Main');
        $jollof = $this->newDish($main['id'], ['name' => 'Jollof rice', 'allergens' => ['celery'], 'onlyForEvent' => true]);
        self::service(Connection::class)->executeStatement("UPDATE events SET starts_at = '2020-06-12 16:00:00', ends_at = '2020-06-13 01:00:00' WHERE id = :id", ['id' => $this->eventId]);

        $this->as($this->owner, 'DELETE', $this->path('/dishes/' . $jollof['id'] . '?askAgain=1'));
        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::MenuEventOver->type(), $this->last()['type'] ?? null);
        $this->as($this->owner, 'POST', $this->path('/courses'), ['name' => 'Dessert']);
        self::assertSame(409, $this->statusCode());
        self::assertSame(['Jollof rice'], $this->dishNames(0), 'nothing was changed');
    }

    #[Test]
    public function theMenuReadsEachCoursesDishesForTheReadyCount(): void
    {
        $starter = $this->course('Starter');
        $this->course('Late-night bites');
        $this->newDish($starter['id'], ['name' => 'Asun', 'containsNone' => true, 'onlyForEvent' => true]);

        self::assertSame([1, 0], Vec\map($this->courses(), fn (array $course): int => Iter\count($this->dishes($course))));
    }

    #[Test]
    public function withoutMenuManageTheMenuReadsAndNothingChanges(): void
    {
        $main = $this->course('Main');
        $dish = $this->newDish($main['id'], ['name' => 'Asun', 'containsNone' => true, 'onlyForEvent' => true]);
        $viewer = $this->member('ada@ire.events', 'Ada Obi', EventRole::CanView);

        $this->as($viewer, 'GET', $this->path());
        self::assertSame(200, $this->statusCode());

        foreach ([
            ['POST', $this->path('/courses'), ['name' => 'Dessert']],
            ['PUT', $this->path('/courses/' . $main['id']), ['name' => 'Mains', 'answer' => 'choose', 'skippable' => false]],
            ['POST', $this->path('/courses/' . $main['id'] . '/move'), ['to' => 0]],
            ['DELETE', $this->path('/courses/' . $main['id']), null],
            ['POST', $this->path('/courses/' . $main['id'] . '/dishes'), ['name' => 'Suya', 'containsNone' => true]],
            ['PUT', $this->path('/dishes/' . $dish['id']), ['name' => 'Asun', 'containsNone' => true]],
            ['DELETE', $this->path('/dishes/' . $dish['id']), null],
        ] as [$method, $path, $body]) {
            $this->as($viewer, $method, $path, $body);
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
        }

        self::assertSame(['Main'], $this->names());
    }

    #[Test]
    public function withoutMenuReadThePageIsRefused(): void
    {
        $viewer = $this->member('ada@ire.events', 'Ada Obi', EventRole::CanView);
        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::MenuRead);

        $this->as($viewer, 'GET', $this->path());

        self::assertSame(403, $this->statusCode());
    }

    #[Test]
    public function anotherOrganisationsEventIsNotFound(): void
    {
        $main = $this->course('Main');
        $stranger = $this->account('stranger@else.where', 'Stranger');
        self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();

        foreach ([['GET', $this->path(), null], ['POST', $this->path('/courses'), ['name' => 'Mine']], ['DELETE', $this->path('/courses/' . $main['id']), null]] as [$method, $path, $body]) {
            $this->as($stranger, $method, $path, $body);
            self::assertSame(404, $this->statusCode(), $method . ' ' . $path);
        }

        self::assertSame(['Main'], $this->names());
    }

    #[Test]
    public function aCourseOfAnotherEventIsNotFound(): void
    {
        $theirs = $this->course('Main');
        $this->eventId = $this->newEvent();

        $this->as($this->owner, 'DELETE', $this->path('/courses/' . $theirs['id']));

        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function eachChangeIsPublishedWholeToTheEventsMenu(): void
    {
        $hub = self::service(RecordingHub::class);
        $this->course('Main');

        $update = $hub->lastOn(RealtimeTopic::EventMenu->for($this->eventId)) ?? self::fail('nothing published');
        self::assertTrue($update->isPrivate());
        self::assertSame(['Main'], Vec\map(Type\shape(['courses' => Type\vec(Type\shape(['name' => Type\string()], true))])->coerce(Json\decode($update->getData()))['courses'], static fn (array $course): string => $course['name']));
    }

    /** Four people who picked it have peanuts or sesame recorded, one twice over, a companion among them; a fifth has Other, a sixth nothing. */
    private function pickedJollof(): string
    {
        $main = $this->course('Main');
        $jollof = $this->newDish($main['id'], ['name' => 'Jollof rice', 'allergens' => ['celery'], 'onlyForEvent' => true]);
        $twice = $this->guest('Tolu Adeyemi', ['peanuts', 'sesame']);

        foreach ([$twice, $twice, $this->guest('Femi Ade', ['sesame']), $this->guest('Kemi Ade', ['peanuts', 'milk']), $this->guest('Bisi Ola', ['other'], 'peanuts'), $this->guest('Dayo Ola', [])] as $person) {
            $this->picks($jollof['id'], $person);
        }

        $this->picks($jollof['id'], $this->companionOf($twice, ['sesame']));

        return $jollof['id'];
    }

    /** @param list<string> $allergens */
    private function guest(string $name, array $allergens, ?string $other = null): Guest
    {
        $event = self::em()->find(Event::class, Uuid::fromString($this->eventId)) ?? self::fail('no event');
        $guest = Guest::listed($event, $name, Str\lowercase($name), null, null, null, Uuid::v4()->toRfc4122(), Uuid::v4()->toRfc4122());
        self::em()->persist($guest);
        $this->recordNeeds($guest, $allergens, $other);

        return $guest;
    }

    /** @param list<string> $allergens */
    private function companionOf(Guest $host, array $allergens): Guest
    {
        $companion = Guest::companionOf($host, null, null, 1, null);
        self::em()->persist($companion);
        $this->recordNeeds($companion, $allergens, null);

        return $companion;
    }

    /** @param list<string> $allergens */
    private function recordNeeds(Guest $person, array $allergens, ?string $other): void
    {
        $needs = GuestNeeds::none();
        self::service(GuestNeedsRecord::class)->write($person, new GuestNeeds(
            [...$needs->codes, NeedKind::Allergen->value => $allergens],
            [...$needs->others, NeedKind::Allergen->value => $other],
            null,
        ), $this->owner);
        self::em()->flush();
    }

    /** @param list<string> $allergens */
    private function libraryDish(string $name, array $allergens, string ...$diets): Dish
    {
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $dish = new Dish($organisation, $name, null, $allergens, Vec\values($diets));
        self::em()->persist($dish);
        self::em()->flush();

        return $dish;
    }

    /** @return array{id: string, name: string, servedAt: ?string, ...} */
    private function course(string $name, ?string $servedAt = null): array
    {
        $answer = $this->as($this->owner, 'POST', $this->path('/courses'), ['name' => $name, 'servedAt' => $servedAt]);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));
        $id = Type\string()->coerce($answer['courseId'] ?? null);

        foreach ($this->coursesOf($answer['menu'] ?? null) as $course) {
            if ($course['id'] === $id) {
                return $course;
            }
        }

        self::fail('no course');
    }

    /** @param array<string, mixed> $fields */
    private function change(string $id, array $fields): void
    {
        $this->as($this->owner, 'PUT', $this->path('/courses/' . $id), [...['name' => 'Starter', 'servedAt' => null, 'answer' => 'choose', 'skippable' => false], ...$fields]);
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array{id: string, name: string, libraryDishId: ?string, ...}
     */
    private function newDish(string $courseId, array $body): array
    {
        $answer = $this->as($this->owner, 'POST', $this->path('/courses/' . $courseId . '/dishes'), $body);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));
        $id = Type\string()->coerce($answer['dishId'] ?? null);

        foreach ($this->coursesOf($answer['menu'] ?? null) as $course) {
            foreach ($this->dishes($course) as $dish) {
                if ($dish['id'] === $id) {
                    return $dish;
                }
            }
        }

        self::fail('no dish');
    }

    /** @return list<array{id: string, name: string, servedAt: ?string, answer: string, skippable: bool, dishes: list<mixed>, ...}> */
    private function courses(): array
    {
        $read = $this->as($this->owner, 'GET', $this->path());
        self::assertSame(200, $this->statusCode());

        return $this->coursesOf($read['menu'] ?? null);
    }

    /** @return list<array{id: string, name: string, servedAt: ?string, answer: string, skippable: bool, dishes: list<mixed>, ...}> */
    private function coursesOf(mixed $menu): array
    {
        return Type\shape(['courses' => Type\vec(Type\shape([
            'id' => Type\string(),
            'name' => Type\string(),
            'servedAt' => Type\nullable(Type\string()),
            'answer' => Type\string(),
            'skippable' => Type\bool(),
            'dishes' => Type\vec(Type\mixed()),
        ], true))], true)->coerce($menu)['courses'];
    }

    /** @return list<array{id: string, name: string, allergens: ?list<string>, diets: list<string>, libraryDishId: ?string, picked: bool, ...}> */
    private function dishes(mixed $course): array
    {
        return Type\vec(Type\shape([
            'id' => Type\string(),
            'name' => Type\string(),
            'allergens' => Type\nullable(Type\vec(Type\string())),
            'diets' => Type\vec(Type\string()),
            'libraryDishId' => Type\nullable(Type\string()),
            'picked' => Type\bool(),
        ], true))->coerce(Type\shape(['dishes' => Type\mixed()], true)->coerce($course)['dishes']);
    }

    /** @return list<string> */
    private function dishNames(int $course): array
    {
        return Vec\map($this->dishes($this->courses()[$course]), static fn (array $dish): string => $dish['name']);
    }

    /** @return array{MealAnswerKind, ?string, ?string} the answer's kind, the pick it kept, and the dish it names */
    private function answered(Guest $person, string $course): array
    {
        self::em()->clear();
        $answers = Vec\filter(self::em()->getRepository(MealAnswer::class)->findBy(['person' => $person->getId()]), static fn (MealAnswer $answer): bool => $answer->getCourse()->getName() === $course);
        $answer = Vec\values($answers)[0] ?? self::fail('no answer to ' . $course);

        return [$answer->getKind(), $answer->getChangedFrom(), $answer->getDish()?->getName()];
    }

    /** @return list<string> */
    private function names(): array
    {
        return Vec\map($this->courses(), static fn (array $course): string => $course['name']);
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

    private function path(string $rest = ''): string
    {
        return '/api/events/' . $this->eventId . '/menu' . $rest;
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

    private function member(string $address, string $name, EventRole $on): User
    {
        $user = $this->account($address, $name);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => SeededRole::Member]);
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
