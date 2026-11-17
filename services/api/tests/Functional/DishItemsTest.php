<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Dish;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** A dish's items and a course's own, Served with this course (sc-34230), and the course's items as one list. */
final class DishItemsTest extends ApiTestCase
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
        $this->owner = $this->account('owner@ire.events', 'Ifeoma Nduka');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'GB', 'Europe/London');
        self::em()->flush();
        $this->eventId = $this->newEvent();
    }

    #[Test]
    public function aDishStartsWithNoItemsAndIsOneItemItself(): void
    {
        $this->course('Main');
        $this->dish('Main', 'Jollof rice');

        self::assertSame([], $this->dishNamed('Jollof rice')['items']);
        self::assertSame(['Jollof rice'], $this->courseNamed('Main')['items']);
        self::assertSame([], $this->courseNamed('Main')['ownItems']);
    }

    #[Test]
    public function aDishOnEveryCourseKeepsItsItemsInOrderTrimmed(): void
    {
        foreach (['Starter', 'Main', 'Dessert'] as $course) {
            $this->course($course);
            $dish = $this->dish($course, $course . ' dish');
            $this->items($dish, [self::fixed(' Rice '), self::fixed('Chicken')]);
            self::assertSame(200, $this->statusCode());
            self::assertSame([['kind' => 'fixed', 'name' => 'Rice'], ['kind' => 'fixed', 'name' => 'Chicken']], $this->dishNamed($course . ' dish')['items']);
        }

        $dish = $this->dishNamed('Main dish')['id'];
        $this->items(Type\string()->coerce($dish), [self::fixed('Chicken'), self::fixed('Rice')]);
        self::assertSame(['Chicken', 'Rice'], $this->courseNamed('Main')['items']);
    }

    #[Test]
    public function savingADishWithoutItemsKeepsThem(): void
    {
        $this->course('Main');
        $dish = $this->dish('Main', 'Jollof rice');
        $this->items($dish, [self::fixed('Rice'), self::fixed('Chicken')]);

        $this->as($this->owner, 'PUT', $this->path('/dishes/' . $dish), ['name' => 'Party jollof', 'containsNone' => true]);
        self::assertSame(200, $this->statusCode());

        self::assertCount(2, $this->dishNamed('Party jollof')['items']);
    }

    /** @return iterable<string, array{list<array<string, string>>, string, string}> */
    public static function refusedItems(): iterable
    {
        $six = Vec\map(Vec\range(1, 7), static fn (int $n): array => self::fixed('Item ' . $n));

        yield 'a 7th item' => [$six, 'items', 'A dish can have at most 6 items.'];
        yield 'a single item' => [[self::fixed('Rice')], 'items', 'List 2 items or more, or none.'];
        yield 'two names the same, ignoring case and spaces' => [[self::fixed('Rice'), self::fixed('Chicken'), self::fixed(' rice ')], 'items.2.name', 'Each item needs its own name.'];
        yield 'a blank name' => [[self::fixed('Rice'), self::fixed('  ')], 'items.1.name', 'Give each item a name.'];
        yield 'a name over 40' => [[self::fixed('Rice'), self::fixed(Str\repeat('a', 41))], 'items.1.name', 'An item’s name can be at most 40 characters.'];
    }

    /** @param list<array<string, string>> $items */
    #[Test]
    #[DataProvider('refusedItems')]
    public function aWrongListIsRefusedBesideTheFieldAndNothingIsSaved(array $items, string $field, string $message): void
    {
        $this->course('Main');
        $dish = $this->dish('Main', 'Jollof rice');

        $this->items($dish, $items);

        self::assertSame(422, $this->statusCode());
        self::assertSame($message, $this->violation($field));
        self::assertSame([], $this->dishNamed('Jollof rice')['items']);
    }

    #[Test]
    public function fortyCharactersAndSixItemsAreAllowed(): void
    {
        $this->course('Main');
        $dish = $this->dish('Main', 'Jollof rice');

        $this->items($dish, [self::fixed(Str\repeat('a', 40)), ...Vec\map(Vec\range(1, 5), static fn (int $n): array => self::fixed('Item ' . $n))]);

        self::assertSame(200, $this->statusCode());
        self::assertCount(6, $this->dishNamed('Jollof rice')['items']);
    }

    #[Test]
    public function aChoiceIsAnItemAndEachOfItsOptionsIsOneOfTheCourses(): void
    {
        $this->course('Main');
        $dish = $this->dish('Main', 'Jollof rice');
        $side = $this->choice($dish, 'And a side?', ['Plantain', 'Rice']);

        $this->items($dish, [self::fixed('Rice'), self::choiceItem($side)]);

        self::assertSame(200, $this->statusCode());
        self::assertSame([['kind' => 'fixed', 'name' => 'Rice'], ['kind' => 'choice', 'choiceId' => $side]], $this->dishNamed('Jollof rice')['items']);
        self::assertSame(['Rice', 'Plantain'], $this->courseNamed('Main')['items']);
    }

    #[Test]
    public function aChoiceNamedLikeAFixedItemOrListedTwiceIsRefused(): void
    {
        $this->course('Main');
        $dish = $this->dish('Main', 'Jollof rice');
        $side = $this->choice($dish, 'And a side?', ['Plantain', 'Salad']);

        $this->items($dish, [self::fixed('and a side?'), self::choiceItem($side)]);
        self::assertSame('Each item needs its own name.', $this->violation('items.1.choiceId'));

        $this->items($dish, [self::choiceItem($side), self::choiceItem($side)]);
        self::assertSame('Each item needs its own name.', $this->violation('items.1.choiceId'));
    }

    #[Test]
    public function aChoiceWithNoQuestionIsRefusedAsAnItemButOneThatLosesItStays(): void
    {
        $this->course('Main');
        $dish = $this->dish('Main', 'Jollof rice');
        $draft = $this->choice($dish, '', ['Mild', 'Hot']);

        $this->items($dish, [self::fixed('Rice'), self::choiceItem($draft)]);
        self::assertSame(422, $this->statusCode());
        self::assertSame('A choice needs its question before it can be an item.', $this->violation('items.1.choiceId'));
        self::assertSame([], $this->dishNamed('Jollof rice')['items']);

        $heat = $this->choice($dish, 'How hot?', ['Mild', 'Hot']);
        $this->items($dish, [self::fixed('Rice'), self::choiceItem($heat)]);
        $this->as($this->owner, 'PUT', $this->path('/choices/' . $heat), self::choiceBody('', ['Mild', 'Hot']));
        self::assertSame(200, $this->statusCode());

        $this->items($dish, [self::choiceItem($heat), self::fixed('Rice')]);
        self::assertSame(200, $this->statusCode());
        self::assertSame([['kind' => 'choice', 'choiceId' => $heat], ['kind' => 'fixed', 'name' => 'Rice']], $this->dishNamed('Jollof rice')['items']);
    }

    #[Test]
    public function removingAChoiceTakesItsItemAndASingleItemLeftGoesToo(): void
    {
        $this->course('Main');
        $dish = $this->dish('Main', 'Jollof rice');
        $side = $this->choice($dish, 'And a side?', ['Plantain', 'Salad']);
        $sauce = $this->choice($dish, 'And a sauce?', ['Shito', 'Pepper sauce']);
        $this->items($dish, [self::fixed('Rice'), self::fixed('Chicken'), self::choiceItem($side), self::choiceItem($sauce)]);

        $this->as($this->owner, 'DELETE', $this->path('/choices/' . $side));
        self::assertSame(200, $this->statusCode());
        self::assertSame([self::fixed('Rice'), self::fixed('Chicken'), ['kind' => 'choice', 'choiceId' => $sauce]], $this->dishNamed('Jollof rice')['items']);

        $this->items($dish, [self::fixed('Rice'), self::choiceItem($sauce)]);
        $this->as($this->owner, 'DELETE', $this->path('/choices/' . $sauce));
        self::assertSame([], $this->dishNamed('Jollof rice')['items']);
    }

    #[Test]
    public function theVariantIsOneItemAndFoldingTakesIt(): void
    {
        $this->course('Main');
        $dish = $this->dish('Main', 'Grilled fish');
        $this->variants($dish, ['Croaker', 'Tilapia']);
        $this->variants($dish, ['Catfish']);

        $this->items($dish, [self::variantItem(), self::fixed('Pepper sauce'), self::fixed('Yam chips')]);
        self::assertSame(200, $this->statusCode());
        self::assertSame(['Croaker', 'Tilapia', 'Catfish', 'Pepper sauce', 'Yam chips'], $this->courseNamed('Main')['items']);

        $variants = $this->variantIds();
        $this->as($this->owner, 'DELETE', $this->path('/variants/' . $variants[2]));
        self::assertCount(3, $this->dishNamed('Grilled fish')['items']);

        $this->as($this->owner, 'DELETE', $this->path('/variants/' . $variants[1]));
        self::assertSame([self::fixed('Pepper sauce'), self::fixed('Yam chips')], $this->dishNamed('Grilled fish')['items']);
    }

    #[Test]
    public function foldingDownToOneItemLeavesNone(): void
    {
        $this->course('Main');
        $dish = $this->dish('Main', 'Grilled fish');
        $this->variants($dish, ['Croaker', 'Tilapia']);
        $this->items($dish, [self::variantItem(), self::fixed('Pepper sauce')]);

        $this->as($this->owner, 'DELETE', $this->path('/variants/' . $this->variantIds()[1]));

        self::assertSame(200, $this->statusCode());
        self::assertSame([], $this->dishNamed('Grilled fish')['items']);
    }

    #[Test]
    public function theVariantIsNotAnItemOfADishWithoutVariants(): void
    {
        $this->course('Main');
        $dish = $this->dish('Main', 'Jollof rice');

        $this->items($dish, [self::variantItem(), self::fixed('Rice')]);

        self::assertSame(404, $this->statusCode());
    }

    /** @param list<array<string, string>> $items */
    #[Test]
    #[DataProvider('namedLikeTheVariants')]
    public function aFixedItemNamedLikeTheVariantItemIsRefused(array $items, string $field): void
    {
        $this->course('Main');
        $dish = $this->dish('Main', 'Grilled fish');
        $this->variants($dish, ['Croaker', 'Tilapia']);
        $this->variants($dish, ['Catfish']);

        $this->items($dish, $items);

        self::assertSame(422, $this->statusCode());
        self::assertSame('Each item needs its own name.', $this->violation($field));
    }

    /** @return iterable<string, array{list<array<string, string>>, string}> */
    public static function namedLikeTheVariants(): iterable
    {
        yield 'after it, in English' => [[self::variantItem(), self::fixed('croaker, Tilapia, or Catfish')], 'items.1.name'];
        yield 'before it, in French' => [[self::fixed('Croaker, Tilapia ou Catfish'), self::variantItem()], 'items.1.kind'];
        yield 'in Spanish' => [[self::variantItem(), self::fixed('Croaker, Tilapia o Catfish')], 'items.1.name'];
    }

    #[Test]
    public function aFixedItemNamedLikeOneVariantOrSomeIsAllowed(): void
    {
        $this->course('Main');
        $dish = $this->dish('Main', 'Grilled fish');
        $this->variants($dish, ['Croaker', 'Tilapia']);
        $this->variants($dish, ['Catfish']);

        $this->items($dish, [self::variantItem(), self::fixed('Croaker'), self::fixed('Croaker or Tilapia')]);

        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function oneNameIsOneItemOnACourseInTheOrderItFirstAppears(): void
    {
        $this->course('Main');
        $jollof = $this->dish('Main', 'Jollof rice');
        $fish = $this->dish('Main', 'Grilled fish');
        $this->dish('Main', 'Moi moi');
        $side = $this->choice($jollof, 'And a side?', ['Plantain', 'Moi moi']);
        $this->variants($fish, ['Croaker', 'Plantain']);
        $this->items($jollof, [self::fixed('Jollof rice'), self::choiceItem($side)]);
        $this->items($fish, [self::fixed(' JOLLOF rice '), self::variantItem()]);
        $this->changeCourse('Main', ['ownItems' => ['Bread roll', 'croaker']]);

        self::assertSame(['Jollof rice', 'Plantain', 'Moi moi', 'Croaker', 'Bread roll'], $this->courseNamed('Main')['items']);
    }

    #[Test]
    public function aCourseKeepsItsOwnItemsInOrderUnderTheSameRules(): void
    {
        $this->course('Main');
        $this->dish('Main', 'Jollof rice');

        $this->changeCourse('Main', ['ownItems' => [' Bread roll ']]);
        self::assertSame(200, $this->statusCode());
        self::assertSame(['Bread roll'], $this->courseNamed('Main')['ownItems']);

        $this->changeCourse('Main', ['ownItems' => ['Side salad', 'Bread roll']]);
        self::assertSame(['Side salad', 'Bread roll'], $this->courseNamed('Main')['ownItems']);
        self::assertSame(['Jollof rice', 'Side salad', 'Bread roll'], $this->courseNamed('Main')['items']);

        $this->changeCourse('Main', ['name' => 'Main']);
        self::assertSame(['Side salad', 'Bread roll'], $this->courseNamed('Main')['ownItems']);

        foreach ([
            [['Bread', 'Water', 'Salad', 'Fruit'], 'ownItems', 'A course can have at most 3 items of its own.'],
            [['Bread', ' BREAD'], 'ownItems.1', 'Each item needs its own name.'],
            [[''], 'ownItems.0', 'Give each item a name.'],
            [[Str\repeat('a', 41)], 'ownItems.0', 'An item’s name can be at most 40 characters.'],
        ] as [$own, $field, $message]) {
            $this->changeCourse('Main', ['ownItems' => $own]);
            self::assertSame(422, $this->statusCode());
            self::assertSame($message, $this->violation($field));
        }

        self::assertSame(['Side salad', 'Bread roll'], $this->courseNamed('Main')['ownItems']);
    }

    #[Test]
    public function aDishAddedFromTheLibraryHasNoItems(): void
    {
        $this->course('Main');
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $library = new Dish($organisation, 'Moi moi', null, ['eggs'], []);
        self::em()->persist($library);
        self::em()->flush();

        $this->as($this->owner, 'POST', $this->path('/courses/' . $this->courseNamed('Main')['id'] . '/dishes'), ['libraryDishId' => $library->getId()->toRfc4122()]);
        self::assertSame(201, $this->statusCode());

        self::assertSame([], $this->dishNamed('Moi moi')['items']);
        $this->as($this->owner, 'GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/dishes');
        self::assertStringNotContainsString('"items"', (string) $this->client->getResponse()->getContent());
    }

    #[Test]
    public function withoutMenuManageNoItemChanges(): void
    {
        $this->course('Main');
        $dish = $this->dish('Main', 'Jollof rice');
        $viewer = $this->member('ada@ire.events', 'Ada Obi', EventRole::CanView);

        $this->as($viewer, 'PUT', $this->path('/dishes/' . $dish), ['name' => 'Jollof rice', 'containsNone' => true, 'items' => [self::fixed('Rice'), self::fixed('Chicken')]]);
        self::assertSame(403, $this->statusCode());

        $this->as($viewer, 'PUT', $this->path('/courses/' . $this->courseNamed('Main')['id']), ['name' => 'Main', 'answer' => 'choose', 'skippable' => false, 'ownItems' => ['Bread roll']]);
        self::assertSame(403, $this->statusCode());

        self::assertSame([], $this->dishNamed('Jollof rice')['items']);
        self::assertSame([], $this->courseNamed('Main')['ownItems']);
    }

    /** @return array{kind: 'fixed', name: string} */
    private static function fixed(string $name): array
    {
        return ['kind' => 'fixed', 'name' => $name];
    }

    /** @return array{kind: 'choice', choiceId: string} */
    private static function choiceItem(string $id): array
    {
        return ['kind' => 'choice', 'choiceId' => $id];
    }

    /** @return array{kind: 'variants'} */
    private static function variantItem(): array
    {
        return ['kind' => 'variants'];
    }

    /**
     * @param list<string> $options
     *
     * @return array<string, mixed>
     */
    private static function choiceBody(string $question, array $options): array
    {
        return [
            'question' => $question,
            'options' => Vec\map($options, static fn (string $name): array => ['name' => $name, 'containsNone' => true]),
            'pick' => 1,
            'required' => true,
        ];
    }

    /** @param list<array<string, string>> $items */
    private function items(string $dishId, array $items): void
    {
        $dish = $this->dishById($dishId);
        $this->as($this->owner, 'PUT', $this->path('/dishes/' . $dishId), ['name' => $dish['name'], 'containsNone' => true, 'items' => $items]);
    }

    /** @param list<string> $options */
    private function choice(string $dishId, string $question, array $options): string
    {
        $answer = $this->as($this->owner, 'POST', $this->path('/dishes/' . $dishId . '/choices'), self::choiceBody($question, $options));
        self::assertSame(201, $this->statusCode(), Json\encode($answer));

        return Type\string()->coerce($answer['choiceId'] ?? null);
    }

    /** @param list<string> $names */
    private function variants(string $dishId, array $names): void
    {
        $answer = $this->as($this->owner, 'POST', $this->path('/dishes/' . $dishId . '/variants'), ['variants' => Vec\map($names, static fn (string $name): array => ['name' => $name, 'for' => 'everyone', 'containsNone' => true])]);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));
    }

    /** @return list<string> */
    private function variantIds(): array
    {
        foreach ($this->allDishes() as $dish) {
            $variants = Type\vec(Type\shape(['id' => Type\string()], true))->coerce($dish['variants'] ?? []);

            if ([] !== $variants) {
                return Vec\map($variants, static fn (array $one): string => $one['id']);
            }
        }

        self::fail('no variants');
    }

    /** @param array<string, mixed> $fields */
    private function changeCourse(string $name, array $fields): void
    {
        $this->as($this->owner, 'PUT', $this->path('/courses/' . $this->courseNamed($name)['id']), [...['name' => $name, 'servedAt' => null, 'answer' => 'choose', 'skippable' => false], ...$fields]);
    }

    private function course(string $name): void
    {
        $answer = $this->as($this->owner, 'POST', $this->path('/courses'), ['name' => $name]);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));
    }

    private function dish(string $course, string $name): string
    {
        $answer = $this->as($this->owner, 'POST', $this->path('/courses/' . $this->courseNamed($course)['id'] . '/dishes'), ['name' => $name, 'containsNone' => true, 'onlyForEvent' => true]);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));

        return Type\string()->coerce($answer['dishId'] ?? null);
    }

    /** @return array{id: string, items: list<string>, ownItems: list<string>, dishes: list<array<string, mixed>>, ...} */
    private function courseNamed(string $name): array
    {
        $read = $this->as($this->owner, 'GET', $this->path());
        self::assertSame(200, $this->statusCode());
        $courses = Type\shape(['courses' => Type\vec(Type\shape([
            'id' => Type\string(),
            'name' => Type\string(),
            'items' => Type\vec(Type\string()),
            'ownItems' => Type\vec(Type\string()),
            'dishes' => Type\vec(Type\dict(Type\string(), Type\mixed())),
        ], true))], true)->coerce($read['menu'] ?? null)['courses'];

        foreach ($courses as $course) {
            if ($course['name'] === $name) {
                return $course;
            }
        }

        self::fail('no course ' . $name);
    }

    /** @return list<array<string, mixed>> */
    private function allDishes(): array
    {
        $read = $this->as($this->owner, 'GET', $this->path());
        $courses = Type\shape(['courses' => Type\vec(Type\shape(['dishes' => Type\vec(Type\dict(Type\string(), Type\mixed()))], true))], true)->coerce($read['menu'] ?? null)['courses'];

        return Vec\flatten(Vec\map($courses, static fn (array $course): array => $course['dishes']));
    }

    /** @return array<string, mixed> */
    private function dishNamed(string $name): array
    {
        foreach ($this->allDishes() as $dish) {
            if (($dish['name'] ?? null) === $name) {
                return $dish;
            }
        }

        self::fail('no dish ' . $name);
    }

    /** @return array<string, mixed> */
    private function dishById(string $id): array
    {
        foreach ($this->allDishes() as $dish) {
            if (($dish['id'] ?? null) === $id) {
                return $dish;
            }
        }

        self::fail('no dish ' . $id);
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
