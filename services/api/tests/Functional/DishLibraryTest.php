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
use Symfony\Component\Uid\Uuid;

/** The organisation's menu library: what each dish contains, and who may change it (sc-3901). */
final class DishLibraryTest extends ApiTestCase
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
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->eventId = $this->newEvent();
    }

    #[Test]
    public function addingADishKeepsWhatItContainsAndSuitsInTheirListsOrder(): void
    {
        $added = $this->add(['name' => '  Moi   moi ', 'description' => ' Steamed bean pudding. ', 'allergens' => ['eggs', 'crustaceans'], 'diets' => ['no_pork', 'halal']]);

        self::assertSame('Moi moi', $added['name']);
        self::assertSame('Steamed bean pudding.', $added['description']);
        self::assertSame(['crustaceans', 'eggs'], $added['allergens']);
        self::assertSame(['halal', 'no_pork'], $added['diets']);
        self::assertFalse($added['usedByEvent']);
        self::assertNull($added['archivedAt']);
        self::assertNull($added['lastPrice']);
    }

    #[Test]
    public function containsNoneIsKeptAsAnAnswerNotABlank(): void
    {
        self::assertSame([], $this->add(['name' => 'Zobo sorbet', 'containsNone' => true])['allergens']);
    }

    #[Test]
    public function aDishWhoseAllergensWereNeverStatedReadsNull(): void
    {
        $dish = new Dish($this->stored(), 'Asun', null, null, []);
        self::em()->persist($dish);
        self::em()->flush();

        self::assertNull($this->dishes()[0]['allergens']);
    }

    /** @return iterable<string, array{array<string, mixed>, string, string}> */
    public static function refused(): iterable
    {
        yield 'no name' => [['name' => '  ', 'containsNone' => true], 'name', 'Enter the dish’s name.'];
        yield 'a name over 120' => [['name' => Str\repeat('a', 121), 'containsNone' => true], 'name', 'Shorten the name to 120 characters or fewer.'];
        yield 'a description over 300' => [['name' => 'Asun', 'description' => Str\repeat('a', 301), 'containsNone' => true], 'description', 'Shorten the description to 300 characters or fewer.'];
        yield 'nothing ticked' => [['name' => 'Asun'], 'allergens', 'Tick what it contains, or Contains none of these.'];
        yield 'an allergen and none' => [['name' => 'Asun', 'allergens' => ['sesame'], 'containsNone' => true], 'allergens', 'Tick what it contains, or Contains none of these.'];
        yield 'vegetarian with fish' => [['name' => 'Asun', 'allergens' => ['fish'], 'diets' => ['vegetarian']], 'diets.vegetarian', 'Vegetarian dishes cannot contain fish, crustaceans or molluscs.'];
        yield 'vegan with milk' => [['name' => 'Asun', 'allergens' => ['milk'], 'diets' => ['vegan']], 'diets.vegan', 'Vegan dishes cannot contain milk or eggs.'];
        yield 'vegan with molluscs' => [['name' => 'Asun', 'allergens' => ['molluscs'], 'diets' => ['vegan']], 'diets.vegan', 'Vegan dishes cannot contain fish, crustaceans or molluscs.'];
        yield 'vegan with eggs and crustaceans' => [['name' => 'Asun', 'allergens' => ['eggs', 'crustaceans'], 'diets' => ['vegan']], 'diets.vegan', 'Vegan dishes cannot contain milk, eggs, fish, crustaceans or molluscs.'];
        yield 'a negative price' => [['name' => 'Asun', 'containsNone' => true, 'lastPrice' => ['amount' => '-5', 'currency' => 'NGN']], 'lastPrice.amount', 'Enter the last price as a number, like 12.50.'];
        yield 'a price in words' => [['name' => 'Asun', 'containsNone' => true, 'lastPrice' => ['amount' => '3,500 naira', 'currency' => 'NGN']], 'lastPrice.amount', 'Enter the last price as a number, like 12.50.'];
        yield 'a price with a comma' => [['name' => 'Asun', 'containsNone' => true, 'lastPrice' => ['amount' => '12,50', 'currency' => 'GBP']], 'lastPrice.amount', 'Enter the last price as a number, like 12.50.'];
        yield 'three decimals in naira' => [['name' => 'Asun', 'containsNone' => true, 'lastPrice' => ['amount' => '12.505', 'currency' => 'NGN']], 'lastPrice.amount', 'Enter the last price as a number, like 12.50.'];
        yield 'decimals in yen' => [['name' => 'Asun', 'containsNone' => true, 'lastPrice' => ['amount' => '3500.50', 'currency' => 'JPY']], 'lastPrice.amount', 'Enter the last price as a number, like 12.'];
        yield 'four decimals in dinar' => [['name' => 'Asun', 'containsNone' => true, 'lastPrice' => ['amount' => '1.2345', 'currency' => 'KWD']], 'lastPrice.amount', 'Enter the last price as a number, like 12.500.'];
        yield 'an amount with no currency' => [['name' => 'Asun', 'containsNone' => true, 'lastPrice' => ['amount' => '4500', 'currency' => '']], 'lastPrice.currency', 'Choose a currency.'];
    }

    /** @param array<string, mixed> $body */
    #[Test]
    #[DataProvider('refused')]
    public function aWrongFieldIsRefusedBesideItAndNothingIsAdded(array $body, string $field, string $message): void
    {
        $this->as($this->owner, 'POST', $this->path(), $body);

        self::assertSame(422, $this->statusCode());
        self::assertSame($message, $this->violation($field));
        self::assertSame([], $this->dishes());
    }

    #[Test]
    public function vegetarianAndVeganClashesAreEachOneLine(): void
    {
        $this->as($this->owner, 'POST', $this->path(), ['name' => 'Seafood okra', 'allergens' => ['crustaceans', 'fish', 'eggs'], 'diets' => ['vegetarian', 'vegan']]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('Vegetarian dishes cannot contain fish, crustaceans or molluscs.', $this->violation('diets.vegetarian'));
        self::assertSame('Vegan dishes cannot contain milk, eggs, fish, crustaceans or molluscs.', $this->violation('diets.vegan'));
    }

    #[Test]
    public function thePriceExampleFollowsTheLanguage(): void
    {
        $this->as($this->owner, 'POST', $this->path(), ['name' => 'Asun', 'containsNone' => true, 'lastPrice' => ['amount' => 'x', 'currency' => 'EUR']], 'fr');

        self::assertSame(422, $this->statusCode());
        self::assertStringContainsString('12,50', $this->violation('lastPrice.amount') ?? '');
    }

    /** @return iterable<string, array{string, string, string}> */
    public static function prices(): iterable
    {
        yield 'naira, whole' => ['4500', 'NGN', '4500.00'];
        yield 'pounds and pence' => ['12.5', 'GBP', '12.50'];
        yield 'yen' => ['3500', 'JPY', '3500'];
        yield 'dinar' => ['12.125', 'KWD', '12.125'];
        yield 'nothing' => ['0', 'EUR', '0.00'];
    }

    #[Test]
    #[DataProvider('prices')]
    public function aLastPriceIsKeptToItsCurrencysMinorUnit(string $amount, string $currency, string $written): void
    {
        $added = $this->add(['name' => 'Asun', 'containsNone' => true, 'lastPrice' => ['amount' => $amount, 'currency' => $currency]]);

        self::assertSame(['amount' => $written, 'currency' => $currency], $added['lastPrice']);
    }

    #[Test]
    public function clearingTheAmountClearsTheLastPriceCurrencyIncluded(): void
    {
        $added = $this->add(['name' => 'Asun', 'containsNone' => true, 'lastPrice' => ['amount' => '4500', 'currency' => 'NGN']]);

        $this->as($this->owner, 'PUT', $this->path($added['id']), ['name' => 'Asun', 'containsNone' => true, 'lastPrice' => ['amount' => '', 'currency' => 'NGN']]);
        self::assertSame(200, $this->statusCode());
        self::assertNull($this->dishes()[0]['lastPrice']);
        self::assertNull($this->dish($added['id'])->getLastPriceCurrency());
    }

    #[Test]
    public function aNameAlreadyInTheLibraryAsksNamingTheStoredName(): void
    {
        $this->add(['name' => 'Jollof rice', 'allergens' => ['celery']]);

        $this->as($this->owner, 'POST', $this->path(), ['name' => 'jollof Ríce', 'allergens' => ['celery']]);

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/dish_name_shared', $this->last()['type'] ?? null);
        self::assertSame('Jollof rice', $this->last()['sharedWith'] ?? null);
        self::assertFalse($this->last()['archived'] ?? null);
        self::assertCount(1, $this->dishes());

        $this->add(['name' => 'jollof Ríce', 'allergens' => ['celery'], 'allowShared' => true]);
        self::assertCount(2, $this->dishes());
    }

    #[Test]
    public function aMatchThatIsOnlyArchivedSaysSo(): void
    {
        $puff = $this->add(['name' => 'Puff puff', 'allergens' => ['gluten']]);
        $this->as($this->owner, 'POST', $this->path($puff['id']) . '/archive');

        $this->as($this->owner, 'POST', $this->path(), ['name' => 'PUFF PUFF', 'allergens' => ['gluten']]);

        self::assertSame(409, $this->statusCode());
        self::assertTrue($this->last()['archived'] ?? null);
    }

    #[Test]
    public function aRenameOntoAnotherDishAsksAndAnUnchangedNameNever(): void
    {
        $this->add(['name' => 'Moi moi', 'allergens' => ['eggs']]);
        $coconut = $this->add(['name' => 'Coconut rice', 'containsNone' => true]);
        $twin = $this->add(['name' => 'Coconut rice', 'containsNone' => true, 'allowShared' => true]);

        $this->as($this->owner, 'PUT', $this->path($coconut['id']), ['name' => 'moi moi', 'containsNone' => true]);
        self::assertSame(409, $this->statusCode());
        self::assertSame('Moi moi', $this->last()['sharedWith'] ?? null);

        $this->as($this->owner, 'PUT', $this->path($coconut['id']), ['name' => 'moi moi', 'containsNone' => true, 'allowShared' => true]);
        self::assertSame(200, $this->statusCode());

        $this->as($this->owner, 'PUT', $this->path($twin['id']), ['name' => 'Coconut rice', 'description' => 'In coconut milk.', 'containsNone' => true]);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function anUnusedDishIsDeleted(): void
    {
        $chin = $this->add(['name' => 'Chin chin', 'allergens' => ['gluten', 'eggs', 'milk']]);

        $this->as($this->owner, 'DELETE', $this->path($chin['id']));

        self::assertSame(204, $this->statusCode());
        self::assertSame([], $this->dishes());
    }

    #[Test]
    public function aDishAnEventUsedIsArchivedAndRestoredNeverDeleted(): void
    {
        $suya = $this->add(['name' => 'Beef suya skewers', 'allergens' => ['peanuts', 'sesame']]);
        $this->dish($suya['id'])->setUsedByEvent(true);
        self::em()->flush();

        $this->as($this->owner, 'DELETE', $this->path($suya['id']));
        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/dish_in_use', $this->last()['type'] ?? null);

        $archived = $this->row($this->as($this->owner, 'POST', $this->path($suya['id']) . '/archive')['dish'] ?? null);
        self::assertSame(200, $this->statusCode());
        self::assertTrue($archived['usedByEvent']);
        self::assertNotNull($archived['archivedAt']);

        $restored = $this->row($this->as($this->owner, 'POST', $this->path($suya['id']) . '/restore')['dish'] ?? null);
        self::assertNull($restored['archivedAt']);
    }

    #[Test]
    public function withoutBudgetReadThereIsNoLastPriceAndAnEditKeepsIt(): void
    {
        $jollof = $this->add(['name' => 'Jollof rice', 'allergens' => ['celery'], 'lastPrice' => ['amount' => '4500', 'currency' => 'NGN']]);
        $editor = $this->member('tunde@ire.events', 'Tunde Bakare', EventRole::CanEdit);

        $listed = $this->row(Type\vec(Type\mixed())->coerce($this->as($editor, 'GET', $this->path())['dishes'] ?? null)[0] ?? null);
        self::assertArrayNotHasKey('lastPrice', $listed);

        $edited = $this->as($editor, 'PUT', $this->path($jollof['id']), ['name' => 'Jollof rice', 'description' => 'Party jollof.', 'allergens' => ['celery']]);
        self::assertSame(200, $this->statusCode());
        self::assertArrayNotHasKey('lastPrice', Type\dict(Type\string(), Type\mixed())->coerce($edited['dish'] ?? null));
        self::assertSame(450000, $this->dish($jollof['id'])->getLastPriceMinor());
        self::assertSame('NGN', $this->dish($jollof['id'])->getLastPriceCurrency());

        $this->as($editor, 'PUT', $this->path($jollof['id']), ['name' => 'Jollof rice', 'allergens' => ['celery'], 'lastPrice' => null]);
        self::assertSame(403, $this->statusCode());
        $this->as($editor, 'POST', $this->path(), ['name' => 'Asun', 'containsNone' => true, 'lastPrice' => ['amount' => '1', 'currency' => 'NGN']]);
        self::assertSame(403, $this->statusCode());
        self::assertSame(450000, $this->dish($jollof['id'])->getLastPriceMinor());
    }

    #[Test]
    public function aLeadOnAnEventSeesTheLastPrice(): void
    {
        $this->add(['name' => 'Jollof rice', 'allergens' => ['celery'], 'lastPrice' => ['amount' => '4500', 'currency' => 'NGN']]);
        $lead = $this->member('ngozi@ire.events', 'Ngozi Eze', EventRole::Lead);

        $listed = $this->row(Type\vec(Type\mixed())->coerce($this->as($lead, 'GET', $this->path())['dishes'] ?? null)[0] ?? null);

        self::assertSame(['amount' => '4500.00', 'currency' => 'NGN'], $listed['lastPrice']);
    }

    #[Test]
    public function withoutMenuManageNothingCanBeChanged(): void
    {
        $jollof = $this->add(['name' => 'Jollof rice', 'allergens' => ['celery']]);
        $viewer = $this->member('ada@ire.events', 'Ada Obi', EventRole::CanView);

        $this->as($viewer, 'GET', $this->path());
        self::assertSame(200, $this->statusCode());

        foreach ([
            ['POST', $this->path(), ['name' => 'Asun', 'containsNone' => true]],
            ['PUT', $this->path($jollof['id']), ['name' => 'Jollof', 'allergens' => ['celery']]],
            ['POST', $this->path($jollof['id']) . '/archive', null],
            ['POST', $this->path($jollof['id']) . '/restore', null],
            ['DELETE', $this->path($jollof['id']), null],
        ] as [$method, $path, $body]) {
            $this->as($viewer, $method, $path, $body);
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
        }

        self::assertSame(['Jollof rice'], Vec\map($this->dishes(), static fn (array $row): string => $row['name']));
    }

    #[Test]
    public function withoutMenuReadThePageIsRefused(): void
    {
        $this->as($this->member('kemi@ire.events', 'Kemi Ade', null), 'GET', $this->path());

        self::assertSame(403, $this->statusCode());
    }

    #[Test]
    public function anotherOrganisationsDishIsNotFound(): void
    {
        $jollof = $this->add(['name' => 'Jollof rice', 'allergens' => ['celery']]);
        $stranger = $this->account('stranger@else.where', 'Stranger');
        $elsewhere = self::service(OrganisationFounder::class)->found($stranger, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $theirs = '/api/orgs/' . $elsewhere->getId()->toRfc4122() . '/dishes/' . $jollof['id'];

        foreach ([['PUT', $theirs, ['name' => 'Mine', 'allergens' => ['celery']]], ['POST', $theirs . '/archive', null], ['DELETE', $theirs, null]] as [$method, $path, $body]) {
            $this->as($stranger, $method, $path, $body);
            self::assertSame(404, $this->statusCode(), $method);
        }

        $this->as($stranger, 'GET', $this->path());
        self::assertSame(404, $this->statusCode());
        self::assertSame('Jollof rice', $this->dish($jollof['id'])->getName());
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array{id: string, name: string, ...}
     */
    private function add(array $body): array
    {
        $answer = $this->as($this->owner, 'POST', $this->path(), $body);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));

        return $this->row($answer['dish'] ?? null);
    }

    /** @return list<array{id: string, name: string, ...}> */
    private function dishes(): array
    {
        return Vec\map(Type\vec(Type\mixed())->coerce($this->as($this->owner, 'GET', $this->path())['dishes'] ?? null), $this->row(...));
    }

    /** @return array{id: string, name: string, ...} */
    private function row(mixed $raw): array
    {
        return Type\shape(['id' => Type\string(), 'name' => Type\string()], true)->coerce($raw);
    }

    private function dish(string $id): Dish
    {
        self::em()->clear();

        return self::em()->find(Dish::class, Uuid::fromString($id)) ?? self::fail('no dish');
    }

    private function stored(): Organisation
    {
        return self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
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

    private function path(?string $id = null): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/dishes' . (null === $id ? '' : '/' . $id);
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

    private function member(string $address, string $name, ?EventRole $on): User
    {
        $user = $this->account($address, $name);
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => SeededRole::Member]);
        self::em()->persist(new Membership($this->stored(), $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active, new DateTimeImmutable()));
        self::em()->flush();

        if (null !== $on) {
            self::onEvent($user, $this->eventId, $on);
        }

        return $user;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null, string $language = 'en'): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
            'HTTP_ACCEPT_LANGUAGE' => $language,
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
