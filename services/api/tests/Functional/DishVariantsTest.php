<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Dish;
use App\Entity\DishVariant;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MealAnswer;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MealAnswerKind;
use App\Enum\MembershipStatus;
use App\Enum\MenuChangeWhy;
use App\Enum\NeedKind;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Double\WithholdingMembershipDirectory;
use App\Tests\Traits\OnboardsAccounts;
use App\Tests\Traits\PutsPeopleOnEvents;
use App\Tests\Traits\StoresMealAnswers;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

final class DishVariantsTest extends ApiTestCase
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
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'GB', 'Europe/London');
        self::em()->flush();
        $this->eventId = $this->newEvent();
    }

    #[Test]
    public function theFirstVariantsComeTwoAtOnceThenOneAtATime(): void
    {
        $jollof = $this->jollof();

        $this->as($this->owner, 'POST', $this->variantsOf($jollof), ['variants' => [self::sent('Chicken')]]);
        self::assertSame(422, $this->statusCode());
        self::assertSame('A dish’s first variants are added two at once.', $this->violation('variants'));

        $this->addVariants($jollof, [self::sent('Chicken'), self::sent('Fish', 'fish')]);

        $this->as($this->owner, 'POST', $this->variantsOf($jollof), ['variants' => [self::sent('Beef'), self::sent('Goat')]]);
        self::assertSame(422, $this->statusCode());

        $this->addVariants($jollof, [self::sent('Beef')]);
        self::assertSame(['Chicken', 'Fish', 'Beef'], Vec\map($this->variants(), static fn (array $one): mixed => $one['name']));
    }

    #[Test]
    public function eachVariantKeepsItsOwnAllergensDietsAndCost(): void
    {
        $jollof = $this->jollof();
        $this->addVariants($jollof, [
            [...self::sent('Chicken', 'celery'), 'diets' => ['halal'], 'cost' => '18.00'],
            [...self::sent('Children’s portion'), 'diets' => ['vegetarian'], 'for' => 'children'],
        ]);

        $variants = $this->variants();
        self::assertSame(['celery'], $variants[0]['allergens']);
        self::assertSame(['halal'], $variants[0]['diets']);
        self::assertSame('everyone', $variants[0]['for']);
        self::assertSame(['amount' => '18.00', 'currency' => 'GBP'], $variants[0]['cost']);
        self::assertSame([], $variants[1]['allergens']);
        self::assertSame('children', $variants[1]['for']);
        self::assertNull($variants[1]['cost']);
        self::assertSame(['celery'], $this->dish()['allergens']);
    }

    #[Test]
    public function aWrongVariantIsRefusedInItsOwnBlockAndNothingIsAdded(): void
    {
        $jollof = $this->jollof();

        $this->as($this->owner, 'POST', $this->variantsOf($jollof), ['variants' => [
            ['name' => '  ', 'for' => 'everyone', 'containsNone' => true],
            ['name' => 'Fish', 'for' => 'everyone', 'allergens' => ['fish'], 'diets' => ['vegetarian'], 'cost' => '12.5.0'],
        ]]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('Enter the variant’s name.', $this->violation('variants.0.name'));
        self::assertSame('Vegetarian dishes cannot contain fish, crustaceans or molluscs.', $this->violation('variants.1.diets.vegetarian'));
        self::assertSame('Enter the cost as a number, like 12.50.', $this->violation('variants.1.cost'));
        self::assertSame([], $this->variants());
    }

    #[Test]
    public function aNameAnotherVariantHasIsRefusedIgnoringCase(): void
    {
        $jollof = $this->jollof();

        $this->as($this->owner, 'POST', $this->variantsOf($jollof), ['variants' => [self::sent('Chicken'), self::sent('chicken')]]);
        self::assertSame('Each variant needs its own name.', $this->violation('variants.1.name'));

        $this->addVariants($jollof, [self::sent('Chicken'), self::sent('Fish')]);
        $this->as($this->owner, 'POST', $this->variantsOf($jollof), ['variants' => [self::sent('FISH')]]);
        self::assertSame('Each variant needs its own name.', $this->violation('variants.0.name'));
    }

    #[Test]
    public function aVariantNameIsAtMostSixtyCharacters(): void
    {
        $jollof = $this->jollof();

        $this->as($this->owner, 'POST', $this->variantsOf($jollof), ['variants' => [self::sent(Str\repeat('a', 61)), self::sent(Str\repeat('b', 60))]]);

        self::assertSame('Shorten the name to 60 characters or fewer.', $this->violation('variants.0.name'));
        self::assertNull($this->violation('variants.1.name'));
    }

    #[Test]
    public function theSeventhVariantIsRefused(): void
    {
        $jollof = $this->jollof();
        $this->addVariants($jollof, [self::sent('One'), self::sent('Two')]);

        foreach (['Three', 'Four', 'Five', 'Six'] as $name) {
            $this->addVariants($jollof, [self::sent($name)]);
        }

        $this->as($this->owner, 'POST', $this->variantsOf($jollof), ['variants' => [self::sent('Seven')]]);

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/variant_limit', $this->last()['type'] ?? null);
        self::assertSame('A dish can have at most 6 variants.', $this->last()['detail'] ?? null);
        self::assertCount(6, $this->variants());
    }

    #[Test]
    public function bothVariantsChildrenOnlyIsRefusedBesideEachFor(): void
    {
        $jollof = $this->jollof();

        $this->as($this->owner, 'POST', $this->variantsOf($jollof), ['variants' => [
            [...self::sent('Children’s portion'), 'for' => 'children'],
            [...self::sent('Children’s plain'), 'for' => 'children'],
        ]]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('At least one variant must be for Everyone.', $this->violation('variants.0.for'));
        self::assertSame('At least one variant must be for Everyone.', $this->violation('variants.1.for'));
        self::assertSame([], $this->variants());
    }

    #[Test]
    public function theLastEveryoneVariantCannotBecomeChildrenOnly(): void
    {
        $jollof = $this->jollof();
        $this->addVariants($jollof, [self::sent('Chicken'), [...self::sent('Children’s portion'), 'for' => 'children']]);
        $chicken = $this->variants()[0]['id'];

        $this->as($this->owner, 'PUT', $this->path('/variants/' . $chicken), [...self::sent('Chicken'), 'for' => 'children']);

        self::assertSame(422, $this->statusCode());
        self::assertSame('At least one variant must be for Everyone.', $this->violation('variants.0.for'));
        self::assertSame('everyone', $this->variants()[0]['for']);
    }

    #[Test]
    public function removingTheLastEveryoneVariantIsRefusedWhileTwoWouldBeLeft(): void
    {
        $jollof = $this->jollof();
        $this->addVariants($jollof, [self::sent('Chicken'), [...self::sent('Children’s portion'), 'for' => 'children']]);
        $this->addVariants($jollof, [[...self::sent('Children’s plain'), 'for' => 'children']]);
        [$chicken, $portion] = Vec\map($this->variants(), static fn (array $one): mixed => $one['id']);

        $this->as($this->owner, 'DELETE', $this->path('/variants/' . Type\string()->coerce($chicken)));
        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/variant_last_everyone', $this->last()['type'] ?? null);
        self::assertSame('Chicken is the only variant for Everyone. Make another variant for Everyone first.', $this->last()['detail'] ?? null);

        $this->as($this->owner, 'DELETE', $this->path('/variants/' . Type\string()->coerce($portion)));
        self::assertSame(200, $this->statusCode());
        self::assertSame(['Chicken', 'Children’s plain'], Vec\map($this->variants(), static fn (array $one): mixed => $one['name']));
    }

    #[Test]
    public function removingDownToOneFoldsItsAllergensDietsAndCostIntoTheDish(): void
    {
        $jollof = $this->jollof();
        $this->addVariants($jollof, [
            [...self::sent('Chicken', 'celery'), 'diets' => ['halal'], 'cost' => '14.00'],
            [...self::sent('Fish', 'fish', 'celery'), 'diets' => ['pescatarian'], 'cost' => '15.50'],
        ]);

        $this->as($this->owner, 'DELETE', $this->path('/variants/' . Type\string()->coerce($this->variants()[0]['id'])));

        self::assertSame(200, $this->statusCode());
        $dish = $this->dish();
        self::assertSame([], $dish['variants']);
        self::assertSame(['fish', 'celery'], $dish['allergens']);
        self::assertSame(['pescatarian'], $dish['diets']);
        self::assertSame(['amount' => '15.50', 'currency' => 'GBP'], $dish['cost']);
    }

    #[Test]
    public function aChildrenOnlyVariantFoldsIntoADishForEveryoneAndNoCostLeavesNone(): void
    {
        $jollof = $this->jollof();
        $this->addVariants($jollof, [[...self::sent('Full bowl', 'fish'), 'cost' => '9.00'], [...self::sent('Children’s portion', 'fish'), 'for' => 'children']]);

        $this->as($this->owner, 'DELETE', $this->path('/variants/' . Type\string()->coerce($this->variants()[0]['id'])));

        self::assertSame(200, $this->statusCode());
        self::assertSame([], $this->dish()['variants']);
        self::assertNull($this->dish()['cost']);
    }

    #[Test]
    public function aPickedDishsFirstVariantsAskThoseWhoPickedItAgainButAFurtherVariantAsksNobody(): void
    {
        $jollof = $this->jollof();
        $tolu = $this->guest('Tolu Adeyemi', []);
        $this->picks($jollof, $tolu);

        $this->as($this->owner, 'POST', $this->variantsOf($jollof), ['variants' => [self::sent('Chicken'), self::sent('Fish')]]);
        self::assertSame(409, $this->statusCode());
        self::assertSame([ErrorCode::MenuChangeAsks->type(), 1], [$this->last()['type'] ?? null, $this->last()['people'] ?? null]);
        self::assertSame([], $this->variants());

        $this->as($this->owner, 'POST', $this->variantsOf($jollof) . '?askAgain=1', ['variants' => [self::sent('Chicken'), self::sent('Fish')]]);
        self::assertSame(201, $this->statusCode());
        $answer = $this->answerOfTheirs($tolu);
        self::assertSame([MealAnswerKind::MenuChanged, MenuChangeWhy::Ways, 2, 'Jollof rice'], [$answer->getKind(), $answer->getChangedWhy(), $answer->getChangedWays(), $answer->getChangedFrom()]);

        $asun = $this->newDish('Main', ['name' => 'Asun', 'allergens' => ['celery'], 'onlyForEvent' => true]);
        $this->addVariants($asun, [self::sent('Goat'), self::sent('Beef')]);
        $this->picks(Type\string()->coerce($this->variants()[0]['id']), $this->guest('Femi Ade', []));
        $this->addVariants($asun, [self::sent('Chicken')]);
        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function removingAPickedVariantAsksThoseWhoPickedItAgain(): void
    {
        $jollof = $this->jollof();
        $this->addVariants($jollof, [self::sent('Chicken'), self::sent('Fish')]);
        $this->addVariants($jollof, [self::sent('Beef')]);
        $chicken = Type\string()->coerce($this->variants()[0]['id']);
        $tolu = $this->guest('Tolu Adeyemi', []);
        $femi = $this->guest('Femi Ade', []);
        $this->picks($chicken, $tolu);
        $this->picks(Type\string()->coerce($this->variants()[1]['id']), $femi);

        $this->as($this->owner, 'DELETE', $this->path('/variants/' . $chicken));
        self::assertSame(409, $this->statusCode());
        self::assertSame([ErrorCode::MenuChangeAsks->type(), 1], [$this->last()['type'] ?? null, $this->last()['people'] ?? null]);
        self::assertTrue($this->variants()[0]['picked']);

        $this->as($this->owner, 'DELETE', $this->path('/variants/' . $chicken . '?askAgain=1'));
        self::assertSame(200, $this->statusCode());
        self::assertSame(['Fish', 'Beef'], Vec\map($this->variants(), static fn (array $one): mixed => $one['name']));
        self::assertSame([MealAnswerKind::MenuChanged, 'Jollof rice, Chicken'], [$this->answerOfTheirs($tolu)->getKind(), $this->answerOfTheirs($tolu)->getChangedFrom()]);
        self::assertSame(MealAnswerKind::Chosen, $this->answerOfTheirs($femi)->getKind());
    }

    #[Test]
    public function aFoldKeepsWhoeverPickedTheVariantThatStaysOnTheDish(): void
    {
        $jollof = $this->jollof();
        $this->addVariants($jollof, [self::sent('Chicken'), self::sent('Fish', 'fish')]);
        $tolu = $this->guest('Tolu Adeyemi', []);
        $this->picks(Type\string()->coerce($this->variants()[0]['id']), $tolu);

        $this->as($this->owner, 'DELETE', $this->path('/variants/' . Type\string()->coerce($this->variants()[1]['id'])));

        self::assertSame(200, $this->statusCode(), 'nobody picked Fish, so nobody is asked');
        self::assertSame([], $this->variants());
        $answer = $this->answerOfTheirs($tolu);
        self::assertSame([MealAnswerKind::Chosen, 'Jollof rice', null], [$answer->getKind(), $answer->getDish()?->getName(), $answer->getVariant()]);
    }

    #[Test]
    public function anAllergenAddedToAPickedVariantAsksAgainThoseWhoPickedItWithItRecorded(): void
    {
        $chicken = $this->pickedChicken();

        $this->as($this->owner, 'PUT', $this->path('/variants/' . $chicken), self::sent('Chicken', 'celery', 'peanuts', 'sesame', 'mustard'));
        self::assertSame(409, $this->statusCode());
        self::assertSame([2, 'allergen', ['peanuts', 'sesame']], [$this->last()['people'] ?? null, $this->last()['whom'] ?? null, $this->last()['allergens'] ?? null]);

        $this->as($this->owner, 'PUT', $this->path('/variants/' . $chicken . '?askAgain=1'), self::sent('Chicken', 'celery', 'peanuts', 'sesame', 'mustard'));
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function nobodyIsAskedWhenNobodyCountedHasItOrTheAllergyIsOtherOrOneIsRemoved(): void
    {
        $chicken = $this->pickedChicken();

        foreach ([self::sent('Chicken', 'celery', 'mustard'), self::sent('Chicken', 'celery', 'mustard', 'lupin'), self::sent('Chicken', 'celery'), self::sent('Chicken')] as $body) {
            $this->as($this->owner, 'PUT', $this->path('/variants/' . $chicken), $body);
            self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        }
    }

    #[Test]
    public function aSetCourseKeepsEveryoneGetsTheSameOnceItsDishHasVariants(): void
    {
        $jollof = $this->jollof();
        $this->as($this->owner, 'PUT', $this->path('/courses/' . $this->courseId()), ['name' => 'Main', 'answer' => 'same', 'skippable' => false]);
        self::assertSame(200, $this->statusCode());

        $this->addVariants($jollof, [self::sent('Chicken'), self::sent('Fish')]);

        self::assertSame('same', $this->course()['answer']);
        $this->as($this->owner, 'PUT', $this->path('/courses/' . $this->courseId()), ['name' => 'Main', 'answer' => 'same', 'skippable' => true]);
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function editingADishWithVariantsTakesOnlyItsNameAndDescription(): void
    {
        $jollof = $this->jollof();
        $this->addVariants($jollof, [self::sent('Chicken'), self::sent('Fish')]);

        $this->as($this->owner, 'PUT', $this->path('/dishes/' . $jollof), ['name' => 'Party jollof', 'description' => 'Smoky']);

        self::assertSame(200, $this->statusCode());
        self::assertSame('Party jollof', $this->dish()['name']);
        self::assertSame(['celery'], $this->dish()['allergens']);
    }

    #[Test]
    public function withoutBudgetReadNoCostIsReadAndOneSentIsRefused(): void
    {
        $jollof = $this->jollof();
        $this->addVariants($jollof, [[...self::sent('Chicken'), 'cost' => '18.00'], self::sent('Fish')]);
        self::service(WithholdingMembershipDirectory::class)->withhold(Permission::BudgetRead);

        self::assertArrayNotHasKey('cost', $this->variants()[0]);
        $this->as($this->owner, 'PUT', $this->path('/variants/' . Type\string()->coerce($this->variants()[0]['id'])), [...self::sent('Chicken'), 'cost' => '20.00']);
        self::assertSame(403, $this->statusCode());

        $this->as($this->owner, 'PUT', $this->path('/variants/' . Type\string()->coerce($this->variants()[0]['id'])), self::sent('Chicken', 'celery'));
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function withoutMenuManageNoVariantChanges(): void
    {
        $jollof = $this->jollof();
        $this->addVariants($jollof, [self::sent('Chicken'), self::sent('Fish')]);
        $chicken = Type\string()->coerce($this->variants()[0]['id']);
        $viewer = $this->member('ada@ire.events', 'Ada Obi', EventRole::CanView);

        foreach ([
            ['POST', $this->variantsOf($jollof), ['variants' => [self::sent('Beef')]]],
            ['PUT', $this->path('/variants/' . $chicken), self::sent('Hen')],
            ['DELETE', $this->path('/variants/' . $chicken), null],
        ] as [$method, $path, $body]) {
            $this->as($viewer, $method, $path, $body);
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
        }

        self::assertSame(['Chicken', 'Fish'], Vec\map($this->variants(), static fn (array $one): mixed => $one['name']));
    }

    #[Test]
    public function aLibraryDishCarriesVariantsWithTheirLastPriceAndFoldsBack(): void
    {
        $library = $this->libraryDish('Coconut rice');

        $added = $this->as($this->owner, 'POST', $this->library('/' . $library->getId()->toRfc4122() . '/variants'), ['variants' => [
            [...self::sent('Fish', 'fish'), 'lastPrice' => ['amount' => '12.00', 'currency' => 'GBP']],
            [...self::sent('Chicken'), 'lastPrice' => ['amount' => '1500', 'currency' => 'NGN']],
        ]]);
        self::assertSame(201, $this->statusCode(), Json\encode($added));
        $variants = $this->libraryVariants($added['dish'] ?? null);
        self::assertSame(['amount' => '12.00', 'currency' => 'GBP'], $variants[0]['lastPrice']);

        $this->as($this->owner, 'DELETE', $this->library('/' . $library->getId()->toRfc4122() . '/variants/' . Type\string()->coerce($variants[1]['id'])));
        self::assertSame(200, $this->statusCode());

        self::em()->clear();
        $folded = self::em()->find(Dish::class, $library->getId()) ?? self::fail('no dish');
        self::assertSame(['fish'], $folded->getAllergens());
        self::assertSame(1200, $folded->getLastPriceMinor());
        self::assertSame('GBP', $folded->getLastPriceCurrency());
        self::assertSame([], self::em()->getRepository(DishVariant::class)->findBy(['dish' => $library->getId()]));
    }

    #[Test]
    public function theLibraryKeepsAnEveryoneVariantToo(): void
    {
        $library = $this->libraryDish('Jollof rice');
        $base = $this->library('/' . $library->getId()->toRfc4122() . '/variants');

        $this->as($this->owner, 'POST', $base, ['variants' => [[...self::sent('Small'), 'for' => 'children'], [...self::sent('Plain'), 'for' => 'children']]]);
        self::assertSame(422, $this->statusCode());
        self::assertSame('At least one variant must be for Everyone.', $this->violation('variants.1.for'));

        $added = $this->as($this->owner, 'POST', $base, ['variants' => [self::sent('Chicken'), [...self::sent('Small'), 'for' => 'children']]]);
        $this->as($this->owner, 'POST', $base, ['variants' => [[...self::sent('Plain'), 'for' => 'children']]]);
        $chicken = Type\string()->coerce($this->libraryVariants($added['dish'] ?? null)[0]['id']);

        $this->as($this->owner, 'DELETE', $base . '/' . $chicken);
        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/variant_last_everyone', $this->last()['type'] ?? null);

        $this->as($this->owner, 'PUT', $base . '/' . $chicken, [...self::sent('Chicken'), 'for' => 'children']);
        self::assertSame(422, $this->statusCode());
    }

    #[Test]
    public function addingALibraryDishCopiesItsVariantsAndALastPriceOnlyInTheEventsCurrency(): void
    {
        $library = $this->libraryDish('Jollof rice');
        $this->as($this->owner, 'POST', $this->library('/' . $library->getId()->toRfc4122() . '/variants'), ['variants' => [
            [...self::sent('Chicken', 'celery'), 'diets' => ['halal'], 'lastPrice' => ['amount' => '6.00', 'currency' => 'GBP']],
            [...self::sent('Children’s portion'), 'for' => 'children', 'lastPrice' => ['amount' => '9.00', 'currency' => 'EUR']],
        ]]);
        self::assertSame(201, $this->statusCode());

        $this->as($this->owner, 'POST', $this->path('/courses/' . $this->courseId() . '/dishes'), ['libraryDishId' => $library->getId()->toRfc4122()]);
        self::assertSame(201, $this->statusCode());

        $variants = $this->variants();
        self::assertSame(['Chicken', 'Children’s portion'], Vec\map($variants, static fn (array $one): mixed => $one['name']));
        self::assertSame(['celery'], $variants[0]['allergens']);
        self::assertSame(['halal'], $variants[0]['diets']);
        self::assertSame('children', $variants[1]['for']);
        self::assertSame(['amount' => '6.00', 'currency' => 'GBP'], $variants[0]['cost']);
        self::assertNull($variants[0]['pricedIn']);
        self::assertNull($variants[1]['cost']);
        self::assertSame('EUR', $variants[1]['pricedIn']);

        $this->as($this->owner, 'PUT', $this->path('/variants/' . Type\string()->coerce($variants[1]['id'])), [...self::sent('Children’s portion'), 'for' => 'children', 'cost' => '7.00']);
        self::assertSame(200, $this->statusCode());
        self::assertNull($this->variants()[1]['pricedIn']);

        self::em()->clear();
        $kept = self::em()->getRepository(DishVariant::class)->findBy(['dish' => $library->getId()], ['position' => 'ASC']);
        self::assertSame([600, 900], Vec\map($kept, static fn (DishVariant $one): ?int => $one->getLastPriceMinor()));
    }

    #[Test]
    public function aVariantsCostHoldsTheEventsCurrencyUntilItIsClearedOrRemoved(): void
    {
        $jollof = $this->jollof();
        $this->addVariants($jollof, [[...self::sent('Chicken'), 'cost' => '0'], self::sent('Fish')]);
        $this->addVariants($jollof, [[...self::sent('Beef'), 'cost' => '12.00']]);

        self::assertSame(409, $this->changeCurrency('EUR'));
        self::assertSame(ErrorCode::EventCurrencyInUse->type(), $this->last()['type'] ?? null);

        $this->as($this->owner, 'PUT', $this->path('/variants/' . Type\string()->coerce($this->variants()[0]['id'])), [...self::sent('Chicken'), 'cost' => null]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(409, $this->changeCurrency('EUR'));

        $this->as($this->owner, 'DELETE', $this->path('/variants/' . Type\string()->coerce($this->variants()[2]['id'])));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(200, $this->changeCurrency('EUR'));
    }

    #[Test]
    public function aDishsCostFromAFoldHoldsTheEventsCurrencyUntilTheDishIsRemoved(): void
    {
        $jollof = $this->jollof();
        $this->addVariants($jollof, [self::sent('Chicken'), [...self::sent('Fish'), 'cost' => '15.50']]);
        $this->as($this->owner, 'DELETE', $this->path('/variants/' . Type\string()->coerce($this->variants()[0]['id'])));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        self::assertSame(409, $this->changeCurrency('EUR'));

        $this->as($this->owner, 'DELETE', $this->path('/dishes/' . $jollof));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(200, $this->changeCurrency('EUR'));
    }

    #[Test]
    public function aDishGivenVariantsAgainLetsGoOfTheCostAFoldGaveIt(): void
    {
        $jollof = $this->jollof();
        $this->addVariants($jollof, [self::sent('Chicken'), [...self::sent('Fish'), 'cost' => '15.50']]);
        $this->as($this->owner, 'DELETE', $this->path('/variants/' . Type\string()->coerce($this->variants()[0]['id'])));
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->addVariants($jollof, [self::sent('Chicken'), self::sent('Fish')]);

        self::assertNull($this->dish()['cost']);
        self::assertSame(200, $this->changeCurrency('EUR'));
    }

    /** Tolu has peanuts and sesame, a companion sesame: both counted. Bisi's peanuts is an Other allergy, and Dayo has nothing recorded. */
    private function pickedChicken(): string
    {
        $jollof = $this->jollof();
        $this->addVariants($jollof, [self::sent('Chicken', 'celery'), self::sent('Fish', 'fish')]);
        $chicken = Type\string()->coerce($this->variants()[0]['id']);
        $tolu = $this->guest('Tolu Adeyemi', ['peanuts', 'sesame']);

        foreach ([$tolu, $tolu, $this->guest('Bisi Ola', ['other'], 'peanuts'), $this->guest('Dayo Ola', [])] as $person) {
            $this->picks($chicken, $person);
        }

        $companion = Guest::companionOf($tolu, null, null, 1, null);
        self::em()->persist($companion);
        $this->recordNeeds($companion, ['sesame'], null);
        $this->picks($chicken, $companion);

        return $chicken;
    }

    /** @return array<string, mixed> */
    private static function sent(string $name, string ...$allergens): array
    {
        return [] === $allergens
            ? ['name' => $name, 'for' => 'everyone', 'containsNone' => true]
            : ['name' => $name, 'for' => 'everyone', 'allergens' => Vec\values($allergens)];
    }

    /** @param list<array<string, mixed>> $variants */
    private function addVariants(string $dishId, array $variants): void
    {
        $answer = $this->as($this->owner, 'POST', $this->variantsOf($dishId), ['variants' => $variants]);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));
    }

    private function jollof(): string
    {
        return $this->newDish('Main', ['name' => 'Jollof rice', 'allergens' => ['celery'], 'onlyForEvent' => true]);
    }

    /** @param array<string, mixed> $body */
    private function newDish(string $course, array $body): string
    {
        $courseId = $this->courseNamed($course);
        $answer = $this->as($this->owner, 'POST', $this->path('/courses/' . $courseId . '/dishes'), $body);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));

        return Type\string()->coerce($answer['dishId'] ?? null);
    }

    private function courseNamed(string $name): string
    {
        foreach ($this->courses() as $course) {
            if ($course['name'] === $name) {
                return $course['id'];
            }
        }

        $answer = $this->as($this->owner, 'POST', $this->path('/courses'), ['name' => $name]);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));

        return Type\string()->coerce($answer['courseId'] ?? null);
    }

    private function courseId(): string
    {
        return $this->courseNamed('Main');
    }

    /** @return array{id: string, name: string, answer: string, dishes: mixed, ...} */
    private function course(): array
    {
        return $this->courses()[0];
    }

    /** @return array<string, mixed> the first dish of the first course */
    private function dish(): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce(Type\vec(Type\mixed())->coerce($this->course()['dishes'])[0]);
    }

    /** @return list<array<string, mixed>> the variants of the last dish of the first course */
    private function variants(): array
    {
        $dishes = Type\vec(Type\shape(['variants' => Type\vec(Type\dict(Type\string(), Type\mixed()))], true))->coerce($this->course()['dishes']);

        return Iter\last($dishes)['variants'] ?? [];
    }

    /** @return list<array{id: string, name: string, answer: string, dishes: mixed, ...}> */
    private function courses(): array
    {
        $read = $this->as($this->owner, 'GET', $this->path());
        self::assertSame(200, $this->statusCode());

        return Type\shape(['courses' => Type\vec(Type\shape([
            'id' => Type\string(),
            'name' => Type\string(),
            'answer' => Type\string(),
            'dishes' => Type\mixed(),
        ], true))], true)->coerce($read['menu'] ?? null)['courses'];
    }

    /** @return list<array<string, mixed>> */
    private function libraryVariants(mixed $dish): array
    {
        return Type\shape(['variants' => Type\vec(Type\dict(Type\string(), Type\mixed()))], true)->coerce($dish)['variants'];
    }

    private function libraryDish(string $name): Dish
    {
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $dish = new Dish($organisation, $name, null, ['celery'], []);
        self::em()->persist($dish);
        self::em()->flush();

        return $dish;
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

    private function answerOfTheirs(Guest $person): MealAnswer
    {
        self::em()->clear();

        return self::em()->getRepository(MealAnswer::class)->findOneBy(['person' => $person->getId()]) ?? self::fail('no answer');
    }

    private function newEvent(): string
    {
        $body = $this->as($this->owner, 'POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/events', [
            'name' => 'Owambe',
            'type' => 'wedding',
            'startsAt' => '2027-03-06T16:00',
            'endsAt' => '2027-03-07T02:00',
            'currency' => 'GBP',
        ]);
        self::assertSame(201, $this->statusCode(), Json\encode($body));

        return Type\shape(['id' => Type\string()], true)->coerce($body['event'] ?? null)['id'];
    }

    private function path(string $rest = ''): string
    {
        return '/api/events/' . $this->eventId . '/menu' . $rest;
    }

    private function variantsOf(string $dishId): string
    {
        return $this->path('/dishes/' . $dishId . '/variants');
    }

    private function library(string $rest): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/dishes' . $rest;
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

    private function changeCurrency(string $currency): int
    {
        $this->as($this->owner, 'GET', '/api/events/' . $this->eventId);
        $tag = (string) $this->client->getResponse()->headers->get('ETag');
        $this->as($this->owner, 'PATCH', '/api/events/' . $this->eventId, ['currency' => $currency], $tag);

        return $this->statusCode();
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
            ...(null === $ifMatch ? [] : ['HTTP_IF_MATCH' => $ifMatch]),
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
