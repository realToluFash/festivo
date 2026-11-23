<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\EventRole;
use App\Enum\MembershipStatus;
use App\Enum\NeedKind;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
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

final class DishChoicesTest extends ApiTestCase
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
    public function aChoiceKeepsItsQuestionOptionsCountAndRequired(): void
    {
        $jollof = $this->jollof();

        $this->addChoice($jollof, self::side());

        $choice = $this->choices()[0];
        self::assertSame('And a side?', $choice['question']);
        self::assertSame(1, $choice['pick']);
        self::assertTrue($choice['required']);
        self::assertFalse($choice['draft']);
        self::assertSame([['Plantain', []], ['Garden salad', ['mustard']], ['Moi moi', ['eggs']]], Vec\map(self::options($choice), static fn (array $one): array => [$one['name'], $one['allergens']]));
        self::assertSame([0, 0, 0], Vec\map(self::options($choice), static fn (array $one): mixed => $one['picks']));
        self::assertTrue($this->dish()['offered']);
        self::assertSame(['celery'], $this->dish()['allergens']);
    }

    #[Test]
    public function theQuestionIsAtMostEightyAndAnOptionNameSixtyCharacters(): void
    {
        $jollof = $this->jollof();

        $this->as($this->owner, 'POST', $this->choicesOf($jollof), [...self::side(), 'question' => Str\repeat('q', 81), 'options' => [self::option(Str\repeat('a', 61)), self::option(Str\repeat('b', 60))]]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('Shorten the question to 80 characters or fewer.', $this->violation('question'));
        self::assertSame('Shorten the name to 60 characters or fewer.', $this->violation('options.0.name'));
        self::assertNull($this->violation('options.1.name'));

        $this->addChoice($jollof, [...self::side(), 'question' => Str\repeat('q', 80), 'options' => [self::option(Str\repeat('a', 60)), self::option('Plantain')]]);
        self::assertCount(1, $this->choices());
    }

    #[Test]
    public function aChoiceHasAtMostEightOptions(): void
    {
        $jollof = $this->jollof();
        $nine = Vec\map(Vec\range(1, 9), static fn (int $n): array => self::option('Side ' . $n));

        $this->as($this->owner, 'POST', $this->choicesOf($jollof), [...self::side(), 'options' => $nine]);
        self::assertSame(422, $this->statusCode());
        self::assertSame('A choice can have at most 8 options.', $this->violation('options'));

        $this->addChoice($jollof, [...self::side(), 'options' => Vec\slice($nine, 0, 8)]);
        self::assertCount(8, self::options($this->choices()[0]));
    }

    #[Test]
    public function aCountPastTheOptionsAChoiceCanHaveIsRefused(): void
    {
        $this->as($this->owner, 'POST', $this->choicesOf($this->jollof()), [...self::side(), 'pick' => 40000]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('A choice can have at most 8 options.', $this->violation('pick'));
    }

    #[Test]
    public function aFourthChoiceIsRefused(): void
    {
        $jollof = $this->jollof();

        foreach (['And a side?', 'And a sauce?', 'And to drink?'] as $question) {
            $this->addChoice($jollof, [...self::side(), 'question' => $question]);
        }

        $this->as($this->owner, 'POST', $this->choicesOf($jollof), [...self::side(), 'question' => 'And dessert?']);

        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/choice_limit', $this->last()['type'] ?? null);
        self::assertCount(3, $this->choices());
    }

    #[Test]
    public function twoOptionsWithOneNameIgnoringCaseAndSpacesAreRefused(): void
    {
        $jollof = $this->jollof();

        $this->as($this->owner, 'POST', $this->choicesOf($jollof), [...self::side(), 'options' => [self::option('Plantain'), self::option('  PLANTAIN ')]]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('Each option needs its own name.', $this->violation('options.1.name'));
        self::assertSame([], $this->choices());
    }

    #[Test]
    public function anOptionNeedsANameAndWhatItContains(): void
    {
        $jollof = $this->jollof();

        $this->as($this->owner, 'POST', $this->choicesOf($jollof), [...self::side(), 'options' => [
            ['name' => '', 'allergens' => ['eggs']],
            ['name' => 'Plantain'],
            ['name' => '  '],
        ]]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('Enter the option’s name.', $this->violation('options.0.name'));
        self::assertSame('Tick what it contains, or Contains none of these.', $this->violation('options.1.allergens'));
        self::assertNull($this->violation('options.2.name'));
    }

    #[Test]
    public function anUnfinishedChoiceSavesAsADraftAndHidesItsDish(): void
    {
        $jollof = $this->jollof();

        foreach ([
            [...self::side(), 'question' => ''],
            [...self::side(), 'options' => [self::option('Plantain'), ['name' => '']]],
            [...self::side(), 'pick' => 3],
        ] as $at => $draft) {
            $answer = $this->as($this->owner, 'POST', $this->choicesOf($jollof), $draft);
            self::assertSame(201, $this->statusCode(), Json\encode($answer));
            self::assertTrue($this->choices()[$at]['draft']);
            self::assertFalse($this->dish()['offered']);
        }

        self::assertCount(1, self::options($this->choices()[1]));
    }

    #[Test]
    public function aCourseOfDraftsOffersNoDishAndOneFinishedDishIsOffered(): void
    {
        $chinChin = $this->newDish('Dessert', ['name' => 'Chin chin', 'containsNone' => true, 'onlyForEvent' => true]);
        $this->addChoice($chinChin, [...self::side(), 'question' => '']);

        self::assertSame([false], Vec\map($this->dishesOf('Dessert'), static fn (array $dish): mixed => $dish['offered']));

        $this->newDish('Dessert', ['name' => 'Puff puff', 'containsNone' => true, 'onlyForEvent' => true]);

        self::assertSame([false, true], Vec\map($this->dishesOf('Dessert'), static fn (array $dish): mixed => $dish['offered']));
    }

    #[Test]
    public function finishingADraftOffersTheDish(): void
    {
        $jollof = $this->jollof();
        $this->addChoice($jollof, [...self::side(), 'question' => '']);
        $choice = $this->choices()[0];

        $this->changeChoice(Type\string()->coerce($choice['id']), [...self::side(), 'options' => $this->sentBack($choice)]);

        self::assertFalse($this->choices()[0]['draft']);
        self::assertTrue($this->dish()['offered']);
    }

    #[Test]
    public function aSetCourseKeepsEveryoneGetsTheSameOnceItsDishHasAChoice(): void
    {
        $jollof = $this->jollof();
        $this->as($this->owner, 'PUT', $this->path('/courses/' . $this->courseNamed('Main')), ['name' => 'Main', 'answer' => 'same', 'skippable' => false]);
        self::assertSame(200, $this->statusCode());

        $this->addChoice($jollof, self::side());
        $this->addChoice($jollof, [...self::side(), 'question' => 'And a sauce?']);

        self::assertSame('same', $this->courses()[0]['answer']);
    }

    #[Test]
    public function aChoiceOnAPickedDishAsksItsPickersAndOnASetCourseAsksEveryoneComing(): void
    {
        $jollof = $this->jollof();
        $this->as($this->owner, 'PUT', $this->path('/courses/' . $this->courseNamed('Main')), ['name' => 'Main', 'answer' => 'same', 'skippable' => false]);

        $this->addChoice($jollof, self::side());
        $this->picks(self::optionId($this->choices()[0], 0), $this->guest('Tolu Adeyemi', []));

        $this->as($this->owner, 'POST', $this->choicesOf($jollof), [...self::side(), 'question' => 'And a sauce?']);
        self::assertSame([409, ErrorCode::MenuChangeAsks->type(), 'everyone', 1], [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['whom'] ?? null, $this->last()['count'] ?? null]);
        self::assertCount(1, $this->choices());

        $starter = $this->courseNamed('Starter');
        $this->as($this->owner, 'POST', $this->path('/courses/' . $starter . '/dishes?askAgain=1'), ['name' => 'Asun', 'containsNone' => true, 'onlyForEvent' => true]);
        $asun = Type\string()->coerce($this->last()['dishId'] ?? null);
        $this->picks($asun, $this->guest('Femi Ade', []));
        $this->as($this->owner, 'POST', $this->choicesOf($asun), self::side());
        self::assertSame([409, 'picked', 1], [$this->statusCode(), $this->last()['whom'] ?? null, $this->last()['count'] ?? null]);
        $this->as($this->owner, 'POST', $this->choicesOf($asun) . '?askAgain=1', self::side());
        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function anAnswerToASetDishsChoiceAsksBeforeRemovingTheDishAndRefusesDeletingItsCourse(): void
    {
        $jollof = $this->jollof();
        $main = $this->courseNamed('Main');
        $this->as($this->owner, 'PUT', $this->path('/courses/' . $main), ['name' => 'Main', 'answer' => 'same', 'skippable' => false]);
        $this->addChoice($jollof, self::side());
        $this->picks(self::optionId($this->choices()[0], 0), $this->guest('Tolu Adeyemi', []));

        $this->as($this->owner, 'DELETE', $this->path('/dishes/' . $jollof));
        self::assertSame([409, ErrorCode::MenuChangeAsks->type()], [$this->statusCode(), $this->last()['type'] ?? null]);

        $this->as($this->owner, 'DELETE', $this->path('/courses/' . $main));
        self::assertSame(409, $this->statusCode());
        self::assertSame('https://soirely.com/errors/menu_course_picked', $this->last()['type'] ?? null);
        self::assertCount(1, $this->choices());
    }

    #[Test]
    public function aPickOfAVariantCountsAsAPickOfTheDish(): void
    {
        $jollof = $this->jollof();
        $added = $this->as($this->owner, 'POST', $this->path('/dishes/' . $jollof . '/variants'), ['variants' => [
            ['name' => 'Chicken', 'for' => 'everyone', 'containsNone' => true],
            ['name' => 'Fish', 'for' => 'everyone', 'allergens' => ['fish']],
        ]]);
        self::assertSame(201, $this->statusCode(), Json\encode($added));
        $this->addChoice($jollof, self::side());
        $variants = Type\vec(Type\shape(['id' => Type\string()], true))->coerce($this->dish()['variants']);
        $this->picks($variants[1]['id'], $this->guest('Tolu Adeyemi', []));

        $this->as($this->owner, 'POST', $this->choicesOf($jollof), [...self::side(), 'question' => 'And a sauce?']);

        self::assertSame(409, $this->statusCode());
    }

    #[Test]
    public function removingAnAnsweredChoiceAsksEveryoneWhoAnsweredIt(): void
    {
        $jollof = $this->jollof();
        $this->addChoice($jollof, self::side());
        $this->addChoice($jollof, [...self::side(), 'question' => 'And a sauce?', 'required' => false]);
        $this->addChoice($jollof, [...self::side(), 'question' => 'And to drink?']);
        [$side, $sauce, $drink] = $this->choices();
        $this->picks(self::optionId($side, 2), $this->guest('Tolu Adeyemi', []));
        $this->picks($jollof, $this->guest('Femi Ade', []));

        $this->as($this->owner, 'DELETE', $this->path('/choices/' . Type\string()->coerce($side['id'])));
        self::assertSame([409, ErrorCode::MenuChangeAsks->type(), 1], [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['count'] ?? null]);

        $this->as($this->owner, 'DELETE', $this->path('/choices/' . Type\string()->coerce($sauce['id'])));
        self::assertSame([409, 2], [$this->statusCode(), $this->last()['count'] ?? null], 'None for me is an answer to it too');

        $this->as($this->owner, 'DELETE', $this->path('/choices/' . Type\string()->coerce($drink['id'])));
        self::assertSame(200, $this->statusCode(), 'nobody has answered a required choice they have no option of');
        self::assertSame(['And a side?', 'And a sauce?'], Vec\map($this->choices(), static fn (array $one): mixed => $one['question']));

        $this->as($this->owner, 'DELETE', $this->path('/choices/' . Type\string()->coerce($side['id']) . '?askAgain=1'));
        self::assertSame(200, $this->statusCode());
        self::assertSame(['And a sauce?'], Vec\map($this->choices(), static fn (array $one): mixed => $one['question']));
    }

    #[Test]
    public function droppingAPickedOptionAsksThoseWhoPickedIt(): void
    {
        $choice = $this->answeredSide();
        $id = Type\string()->coerce($choice['id']);
        $sent = $this->sentBack($choice);

        $this->as($this->owner, 'PUT', $this->path('/choices/' . $id), [...self::side(), 'options' => [$sent[0], $sent[1]]]);
        self::assertSame([409, ErrorCode::MenuChangeAsks->type(), 1], [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['count'] ?? null]);

        $this->changeChoice($id, [...self::side(), 'options' => [$sent[1], $sent[2]]]);
        self::assertSame(['Garden salad', 'Moi moi'], Vec\map(self::options($this->choices()[0]), static fn (array $one): mixed => $one['name']));
    }

    #[Test]
    public function turningRequiredOnAsksNoneForMeAndChangingThePickAsksEveryoneWhoAnswered(): void
    {
        $choice = $this->answeredSide(required: false);
        $id = Type\string()->coerce($choice['id']);
        $this->picks(Type\string()->coerce($this->dish()['id']), $this->guest('Femi Ade', []));
        $sent = [...self::side(), 'required' => false, 'options' => $this->sentBack($choice)];
        self::assertSame(1, $this->choices()[0]['noneAnswers']);

        $this->as($this->owner, 'PUT', $this->path('/choices/' . $id), [...$sent, 'required' => true]);
        self::assertSame([409, 1], [$this->statusCode(), $this->last()['count'] ?? null]);
        $this->as($this->owner, 'PUT', $this->path('/choices/' . $id), [...$sent, 'pick' => 2]);
        self::assertSame([409, 2], [$this->statusCode(), $this->last()['count'] ?? null]);
        self::assertSame(1, $this->choices()[0]['pick']);

        $this->changeChoice($id, [...$sent, 'question' => 'Any side?', 'options' => [...$sent['options'], self::option('Coleslaw', 'eggs')]]);
        $this->changeChoice($id, [...$sent, 'question' => 'Any side?', 'required' => false]);
    }

    #[Test]
    public function anAnsweredChoiceCannotBecomeADraft(): void
    {
        $choice = $this->answeredSide();
        $id = Type\string()->coerce($choice['id']);
        $sent = $this->sentBack($choice);

        $this->as($this->owner, 'PUT', $this->path('/choices/' . $id), [...self::side(), 'question' => '', 'options' => [$sent[2]]]);

        self::assertSame(422, $this->statusCode());
        self::assertSame(
            ['Guests have answered this choice, so it has to stay finished.', 'Add the question guests see.', 'Add at least 2 options.'],
            $this->violations('draft'),
        );
        self::assertFalse($this->choices()[0]['draft']);
    }

    #[Test]
    public function anAnsweredChoiceTakesANewOptionNewNamesAndRequiredOff(): void
    {
        $choice = $this->answeredSide();
        $id = Type\string()->coerce($choice['id']);
        $sent = $this->sentBack($choice);

        $this->changeChoice($id, [
            ...self::side(),
            'question' => 'Which side?',
            'required' => false,
            'options' => [[...$sent[0], 'name' => 'Dodo'], $sent[1], $sent[2], self::option('Coleslaw', 'eggs')],
        ]);

        $saved = $this->choices()[0];
        self::assertSame('Which side?', $saved['question']);
        self::assertFalse($saved['required']);
        self::assertSame(['Dodo', 'Garden salad', 'Moi moi', 'Coleslaw'], Vec\map(self::options($saved), static fn (array $one): mixed => $one['name']));
    }

    #[Test]
    public function kitchenPrepCountsEachOptionsPicks(): void
    {
        $choice = $this->answeredSide();
        $this->picks(self::optionId($choice, 0), $this->guest('Femi Ade', []));
        $this->picks(self::optionId($choice, 0), $this->guest('Kemi Ade', []));

        self::assertSame([2, 0, 1], Vec\map(self::options($this->choices()[0]), static fn (array $one): mixed => $one['picks']));
    }

    #[Test]
    public function anAllergenAddedToPickedOptionsAsksAgainOnlyThoseWhoPickedThemWithItRecorded(): void
    {
        $choice = $this->sideWithPickers();
        $id = Type\string()->coerce($choice['id']);
        $sent = $this->sentBack($choice);
        $body = [...self::side(), 'options' => [
            $sent[0],
            [...$sent[1], 'allergens' => ['celery', 'mustard']],
            [...$sent[2], 'allergens' => ['crustaceans', 'eggs', 'milk']],
        ]];

        $this->as($this->owner, 'PUT', $this->path('/choices/' . $id), $body);
        self::assertSame([409, 5, 'allergen', ['crustaceans', 'celery']], [$this->statusCode(), $this->last()['count'] ?? null, $this->last()['whom'] ?? null, $this->last()['allergens'] ?? null]);
        self::assertSame(['mustard'], self::options($this->choices()[0])[1]['allergens']);

        $this->changeChoice($id . '?askAgain=1', $body);
        self::assertSame(['celery', 'mustard'], self::options($this->choices()[0])[1]['allergens']);
    }

    #[Test]
    public function nobodyIsAskedWhenNobodyCountedHasItTheAllergyIsOtherOrOneIsRemoved(): void
    {
        $choice = $this->sideWithPickers();
        $id = Type\string()->coerce($choice['id']);
        $sent = $this->sentBack($choice);

        foreach ([
            [...$sent[2], 'allergens' => ['eggs', 'milk']],
            [...$sent[2], 'allergens' => ['eggs', 'peanuts']],
            [...$sent[2], 'allergens' => ['eggs']],
            ['id' => $sent[2]['id'], 'name' => 'Moi moi', 'containsNone' => true],
        ] as $moiMoi) {
            $this->changeChoice($id, [...self::side(), 'options' => [$sent[0], $sent[1], $moiMoi]]);
        }
    }

    #[Test]
    public function withoutMenuManageNoChoiceChanges(): void
    {
        $jollof = $this->jollof();
        $this->addChoice($jollof, self::side());
        $id = Type\string()->coerce($this->choices()[0]['id']);
        $viewer = $this->member('ada@ire.events', 'Ada Obi', EventRole::CanView);

        foreach ([
            ['POST', $this->choicesOf($jollof), self::side()],
            ['PUT', $this->path('/choices/' . $id), [...self::side(), 'question' => 'Which side?']],
            ['DELETE', $this->path('/choices/' . $id), null],
        ] as [$method, $path, $body]) {
            $this->as($viewer, $method, $path, $body);
            self::assertSame(403, $this->statusCode(), $method . ' ' . $path);
        }

        self::assertSame(['And a side?'], Vec\map($this->choices(), static fn (array $one): mixed => $one['question']));
    }

    #[Test]
    public function aDishWithoutChoicesIsOfferedAsBefore(): void
    {
        $this->jollof();

        self::assertSame([], $this->dish()['choices']);
        self::assertTrue($this->dish()['offered']);
    }

    private function answeredSide(bool $required = true): array
    {
        $jollof = $this->jollof();
        $this->addChoice($jollof, [...self::side(), 'required' => $required]);
        $this->picks(self::optionId($this->choices()[0], 2), $this->guest('Tolu Adeyemi', []));

        return $this->choices()[0];
    }

    /** Garden salad: two with celery and one whose celery is an Other allergy. Moi moi: one with crustaceans and sesame, two with crustaceans, and one with nothing. */
    private function sideWithPickers(): array
    {
        $jollof = $this->jollof();
        $this->addChoice($jollof, self::side());
        $choice = $this->choices()[0];

        foreach ([$this->guest('Bisi Ola', ['celery']), $this->guest('Dayo Ola', ['celery']), $this->guest('Femi Ade', ['other'], 'celery')] as $person) {
            $this->picks(self::optionId($choice, 1), $person);
        }

        foreach ([$this->guest('Kemi Ade', ['crustaceans', 'sesame']), $this->guest('Lola Ade', ['crustaceans']), $this->guest('Musa Ade', ['crustaceans']), $this->guest('Ngozi Ade', [])] as $person) {
            $this->picks(self::optionId($choice, 2), $person);
        }

        return $choice;
    }

    /** @return array{question: string, options: list<array<string, mixed>>, pick: int, required: bool} */
    private static function side(): array
    {
        return [
            'question' => 'And a side?',
            'options' => [self::option('Plantain'), self::option('Garden salad', 'mustard'), self::option('Moi moi', 'eggs')],
            'pick' => 1,
            'required' => true,
        ];
    }

    /** @return array<string, mixed> */
    private static function option(string $name, string ...$allergens): array
    {
        return [] === $allergens
            ? ['name' => $name, 'containsNone' => true]
            : ['name' => $name, 'allergens' => Vec\values($allergens)];
    }

    /** @return list<array<string, mixed>> the choice's options as its form sends them back */
    private function sentBack(mixed $choice): array
    {
        return Vec\map(self::options($choice), static fn (array $one): array => [] === $one['allergens']
            ? ['id' => $one['id'], 'name' => $one['name'], 'containsNone' => true]
            : ['id' => $one['id'], 'name' => $one['name'], 'allergens' => $one['allergens']]);
    }

    /** @return list<array<string, mixed>> */
    private static function options(mixed $choice): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\dict(Type\string(), Type\mixed())->coerce($choice)['options'] ?? null);
    }

    private static function optionId(mixed $choice, int $at): string
    {
        return Type\string()->coerce(self::options($choice)[$at]['id']);
    }

    /** @param array<string, mixed> $body */
    private function addChoice(string $dishId, array $body): void
    {
        $answer = $this->as($this->owner, 'POST', $this->choicesOf($dishId), $body);
        self::assertSame(201, $this->statusCode(), Json\encode($answer));
    }

    /** @return array<string, mixed> */
    private function changeChoice(string $choiceId, mixed $body): array
    {
        $answer = $this->as($this->owner, 'PUT', $this->path('/choices/' . $choiceId), $body);
        self::assertSame(200, $this->statusCode(), Json\encode($answer));

        return $answer;
    }

    private function jollof(): string
    {
        return $this->newDish('Main', ['name' => 'Jollof rice', 'allergens' => ['celery'], 'onlyForEvent' => true]);
    }

    /** @param array<string, mixed> $body */
    private function newDish(string $course, array $body): string
    {
        $answer = $this->as($this->owner, 'POST', $this->path('/courses/' . $this->courseNamed($course) . '/dishes'), $body);
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

    /** @return list<array<string, mixed>> */
    private function dishesOf(string $course): array
    {
        foreach ($this->courses() as $one) {
            if ($one['name'] === $course) {
                return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($one['dishes']);
            }
        }

        return [];
    }

    /** @return array<string, mixed> the first dish of Main */
    private function dish(): array
    {
        return $this->dishesOf('Main')[0];
    }

    /** @return list<array<string, mixed>> */
    private function choices(): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->dish()['choices']);
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

    /** @param list<string> $allergens */
    private function guest(string $name, array $allergens, ?string $other = null): Guest
    {
        $event = self::em()->find(Event::class, Uuid::fromString($this->eventId)) ?? self::fail('no event');
        $guest = Guest::listed($event, $name, Str\lowercase($name), null, null, null, Uuid::v4()->toRfc4122(), Uuid::v4()->toRfc4122());
        self::em()->persist($guest);
        $needs = GuestNeeds::none();
        self::service(GuestNeedsRecord::class)->write($guest, new GuestNeeds(
            [...$needs->codes, NeedKind::Allergen->value => $allergens],
            [...$needs->others, NeedKind::Allergen->value => $other],
            null,
        ), $this->owner);
        self::em()->flush();

        return $guest;
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

    private function choicesOf(string $dishId): string
    {
        return $this->path('/dishes/' . $dishId . '/choices');
    }

    private function violation(string $path): ?string
    {
        return Iter\first($this->violations($path));
    }

    /** @return list<string> */
    private function violations(string $path): array
    {
        $violations = Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []);

        return Vec\map(Vec\filter($violations, static fn (array $one): bool => $one['propertyPath'] === $path), static fn (array $one): string => $one['message']);
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
