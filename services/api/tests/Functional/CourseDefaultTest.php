<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\MenuDishChoice;
use App\Entity\MenuDishVariant;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\NeedKind;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
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
use SensitiveParameter;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Uid\Uuid;

/** A course's default and choose-by date (sc-1362): set together on Edit course, given at the date to everyone coming with no answer whom it can't harm, and worked out rather than stored. */
final class CourseDefaultTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;

    private string $eventId;

    private MenuCourse $starter;

    private MenuCourse $main;

    private MenuDish $jollof;

    private MenuDish $suya;

    private MenuDish $stew;

    private MenuDishVariant $plate;

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
        $soup = new MenuDish($this->starter, null, 'Pepper soup', null, [], [], 0);
        $this->main = new MenuCourse($event, 'Main', null, 1);
        $this->jollof = new MenuDish($this->main, null, 'Jollof rice', null, [], ['vegetarian', 'halal'], 0);
        $this->suya = new MenuDish($this->main, null, 'Beef suya skewers', null, [], [], 1);
        $this->stew = new MenuDish($this->main, null, 'Rice and stew', null, [], [], 2);
        $this->plate = new MenuDishVariant($this->stew, 'Plate', false, [], ['halal'], null, 0);
        $this->kidsPlate = new MenuDishVariant($this->stew, 'Kids plate', true, [], ['halal'], null, 1);

        foreach ([$this->starter, $soup, $this->main, $this->jollof, $this->suya, $this->stew, $this->plate, $this->kidsPlate] as $row) {
            self::em()->persist($row);
        }

        self::em()->flush();
    }

    /** @param array<string, mixed> $default */
    #[Test]
    #[DataProvider('wrongDefaults')]
    public function aWrongPairIsRefusedBesideItsFieldAndNothingIsSaved(array $default, string $path, string $message): void
    {
        $this->changeMain(self::resolve($default, $this));

        self::assertSame(422, $this->statusCode(), Json\encode($this->last()));
        self::assertContains(['propertyPath' => $path, 'message' => $message], Vec\map(
            Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? null),
            static fn (array $one): array => ['propertyPath' => $one['propertyPath'], 'message' => $one['message']],
        ));
        self::assertNull($this->mainOf($this->menu())['default']);
    }

    /** @return iterable<string, array{array<string, mixed>, string, string}> */
    public static function wrongDefaults(): iterable
    {
        yield 'a default with no date' => [['dish' => 'jollof', 'chooseBy' => null], 'default.chooseBy', 'Enter a choose-by date, or set the default to No default.'];
        yield 'a date with no default' => [['dish' => null, 'chooseBy' => '2026-10-10'], 'default.dish', 'Choose a default dish, or clear the choose-by date.'];
        yield 'a date on the event' => [['dish' => 'jollof', 'chooseBy' => '2030-11-14'], 'default.chooseBy', 'Choose a date before the event.'];
        yield 'a date in the past' => [['dish' => 'jollof', 'chooseBy' => '2026-10-02'], 'default.chooseBy', 'That date has passed. Choose today or later.'];
        yield 'a dish with variants and none named' => [['dish' => 'stew', 'chooseBy' => '2026-10-10'], 'default.variant', 'Choose the default’s variant.'];
        yield 'a Children only variant' => [['dish' => 'stew', 'variant' => 'kidsPlate', 'chooseBy' => '2026-10-10'], 'default.variant', 'Choose the default’s variant.'];
    }

    #[Test]
    public function theDateClosesTheCourseAtItsEndInTheEventsZone(): void
    {
        $this->changeMain(['dish' => $this->id($this->stew), 'variant' => $this->plate->getId()->toRfc4122(), 'chooseBy' => '2026-10-10']);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $main = $this->mainOf($this->last());
        self::assertSame(['dish' => $this->id($this->stew), 'variant' => $this->plate->getId()->toRfc4122(), 'options' => [], 'chooseBy' => '2026-10-10'], $main['default']);
        self::assertSame(['at' => '2026-10-10T23:59:59+01:00', 'source' => 'chooseBy', 'closed' => false], $main['picksClose']);

        self::mockTime(new DateTimeImmutable('2026-10-10T22:59:59+00:00'));
        self::assertTrue(Type\shape(['closed' => Type\bool()], true)->coerce($this->mainOf($this->menu())['picksClose'])['closed']);

        $this->changeMain(['dish' => null, 'chooseBy' => null]);
        self::assertSame(422, $this->statusCode(), 'a passed date cannot be cleared');
        $this->changeMain(['dish' => $this->id($this->jollof), 'chooseBy' => '2026-10-20']);
        self::assertSame(422, $this->statusCode(), 'a passed date is locked');
    }

    #[Test]
    public function clearingThePairHandsTheCloseBackToTheEvent(): void
    {
        $this->changeMain(['dish' => $this->id($this->jollof), 'chooseBy' => '2026-10-10']);
        $this->changeMain(['dish' => null, 'chooseBy' => null]);

        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $main = $this->mainOf($this->last());
        self::assertNull($main['default']);
        self::assertSame('start', Type\shape(['source' => Type\string()], true)->coerce($main['picksClose'])['source']);
    }

    #[Test]
    public function atTheDateEveryoneWithNoAnswerIsGivenTheDefaultExceptWhomItCouldHarm(): void
    {
        $token = $this->coming([['fullName' => 'Chidi Okonkwo'], ['fullName' => 'Ada Obi'], ['fullName' => 'Kojo Asante']]);
        [$bisi, $chidi, $ada, $kojo] = [$this->personId('Bisi Adewale'), $this->personId('Chidi Okonkwo'), $this->personId('Ada Obi'), $this->personId('Kojo Asante')];
        $this->records($chidi, ['celery']);
        $this->records($ada, [], 'vegan');
        $this->meals($token, [['person' => $bisi, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->suya)]]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->changeMain(['dish' => $this->id($this->jollof), 'chooseBy' => '2026-10-10']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $before = $this->picks();
        self::assertSame(0, self::row(self::course($before, 'Main'), 'Jollof rice')['defaulted']);
        self::assertSame([], $before['given']);
        self::assertSame([['course' => $this->id($this->main), 'reason' => 'allergy']], self::waiting($before, $chidi)['excluded']);

        self::mockTime(new DateTimeImmutable('2026-10-11T09:00:00+00:00'));
        $picks = $this->picks();
        $main = self::course($picks, 'Main');

        self::assertSame([1, 0], [self::row($main, 'Jollof rice')['defaulted'], self::row($main, 'Jollof rice')['chosen']]);
        self::assertSame(2, $main['notChosen']);
        self::assertSame(2, $picks['answered']);
        self::assertSame([['course' => $this->id($this->main), 'reason' => 'allergy']], self::waiting($picks, $chidi)['excluded']);
        self::assertSame([['course' => $this->id($this->main), 'reason' => 'vegan']], self::waiting($picks, $ada)['excluded']);
        self::assertSame([['id' => $bisi, 'replier' => 'Bisi Adewale', 'people' => [[
            'id' => $kojo,
            'name' => 'Kojo Asante',
            'courses' => [['course' => $this->id($this->main), 'dish' => $this->id($this->jollof), 'variant' => null, 'options' => []]],
        ]]]], $picks['given']);

        $this->anonymous('/api/guest-links/page', ['token' => $token]);
        $meals = Type\shape(['answers' => Type\dict(Type\string(), Type\vec(Type\mixed_dict())), 'excluded' => Type\dict(Type\string(), Type\mixed())], true)->coerce($this->last()['meals'] ?? null);
        self::assertSame([['course' => $this->id($this->main), 'answer' => 'defaulted', 'dish' => $this->id($this->jollof), 'variant' => null, 'options' => [], 'changed' => null]], $meals['answers'][$kojo]);
        self::assertSame([['course' => $this->id($this->main), 'reason' => 'vegan']], $meals['excluded'][$ada]);

        $this->records($ada, []);
        self::assertSame(2, self::row(self::course($this->picks(), 'Main'), 'Jollof rice')['defaulted'], 'a diet removed gives the default again');
    }

    #[Test]
    public function changingTheDefaultAfterTheDateAsksWhoMovesAndWhoGoesBack(): void
    {
        $this->coming([['fullName' => 'Kojo Asante'], ['fullName' => 'Ada Obi']]);
        [$kojo, $ada] = [$this->personId('Kojo Asante'), $this->personId('Ada Obi')];
        $this->records($kojo, [], 'halal');
        $this->changeMain(['dish' => $this->id($this->jollof), 'chooseBy' => '2026-10-10']);
        self::mockTime(new DateTimeImmutable('2026-10-11T09:00:00+00:00'));
        self::assertSame(3, self::row(self::course($this->picks(), 'Main'), 'Jollof rice')['defaulted']);

        $this->changeMain(['dish' => $this->id($this->suya), 'chooseBy' => '2026-10-10']);

        self::assertSame(409, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(['https://soirely.com/errors/menu_default_move', 2, 1], [$this->last()['type'] ?? null, $this->last()['move'] ?? null, $this->last()['back'] ?? null]);
        self::assertSame($this->id($this->jollof), Type\shape(['dish' => Type\string()], true)->coerce($this->mainOf($this->menu())['default'])['dish'], 'nothing changes until confirmed');

        $this->changeMain(['dish' => $this->id($this->suya), 'chooseBy' => '2026-10-10'], confirmMove: true);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $picks = $this->picks();
        self::assertSame(2, self::row(self::course($picks, 'Main'), 'Beef suya skewers')['defaulted']);
        self::assertSame([['course' => $this->id($this->main), 'reason' => 'halal']], self::waiting($picks, $kojo)['excluded']);

        $this->chooseFor($ada, ['answer' => 'chosen', 'dish' => $this->id($this->suya)]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $chosen = $this->picks();
        self::assertSame([1, 1], [self::row(self::course($chosen, 'Main'), 'Beef suya skewers')['chosen'], self::row(self::course($chosen, 'Main'), 'Beef suya skewers')['defaulted']]);
        self::assertNotContains($ada, Vec\flat_map(Type\vec(Type\shape(['people' => Type\vec(Type\shape(['id' => Type\string()], true))], true))->coerce($chosen['given']), static fn (array $party): array => Vec\map($party['people'], static fn (array $one): string => $one['id'])));
    }

    #[Test]
    public function theDefaultCannotBeRemovedWhileItIsTheDefault(): void
    {
        $this->changeMain(['dish' => $this->id($this->stew), 'variant' => $this->plate->getId()->toRfc4122(), 'chooseBy' => '2026-10-10']);

        $this->as('DELETE', '/api/events/' . $this->eventId . '/menu/dishes/' . $this->id($this->stew));
        self::assertSame([409, 'https://soirely.com/errors/menu_is_default', 'Rice and stew is Main’s default. Choose another default first, in Edit course.'], [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['detail'] ?? null]);

        $this->as('DELETE', '/api/events/' . $this->eventId . '/menu/variants/' . $this->plate->getId()->toRfc4122());
        self::assertSame([409, 'https://soirely.com/errors/menu_is_default'], [$this->statusCode(), $this->last()['type'] ?? null]);

        $this->as('DELETE', '/api/events/' . $this->eventId . '/menu/dishes/' . $this->id($this->suya));
        self::assertSame(200, $this->statusCode(), 'another dish still goes');
    }

    #[Test]
    public function aDefaultOptionCannotBeRemovedThroughItsChoice(): void
    {
        $hot = $this->choice($this->stew, 'How hot?', true, ['Mild', 'Hot', 'Very hot']);
        [$mild, $spicy, $very] = $this->optionIds($hot);
        $this->changeMain(['dish' => $this->id($this->stew), 'variant' => $this->plate->getId()->toRfc4122(), 'options' => [$mild], 'chooseBy' => '2026-10-10']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        $this->as('PUT', $this->choicePath($hot), self::asked('How hot?', [[$spicy, 'Hot'], [$very, 'Very hot'], [null, 'Medium']], required: true));
        self::assertSame([409, 'https://soirely.com/errors/menu_is_default', 'Mild is part of Main’s default. Choose another default first, in Edit course.'], [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['detail'] ?? null]);

        $this->as('DELETE', $this->choicePath($hot));
        self::assertSame([409, 'https://soirely.com/errors/menu_is_default'], [$this->statusCode(), $this->last()['type'] ?? null]);
        self::assertCount(3, $this->optionIds($hot), 'nothing is removed');
    }

    #[Test]
    public function anEditThatLeavesTheDefaultUnfinishedIsRefused(): void
    {
        self::em()->persist(new MenuDishVariant($this->stew, 'Party plate', false, [], ['halal'], null, 2));
        self::em()->flush();
        $side = $this->choice($this->jollof, 'And a side?', false, ['Plantain', 'Salad']);
        [$plantain, $salad] = $this->optionIds($side);
        $this->changeMain(['dish' => $this->id($this->jollof), 'chooseBy' => '2026-10-10']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $sides = [[$plantain, 'Plantain'], [$salad, 'Salad']];
        $refused = [
            'Required turned on' => ['PUT', $this->choicePath($side), self::asked('And a side?', $sides, required: true)],
            'a choice saved as a draft' => ['PUT', $this->choicePath($side), self::asked('And a side?', [[$plantain, 'Plantain']], required: false)],
            'a required choice added' => ['POST', $this->dishPath($this->jollof) . '/choices', self::asked('A drink?', [[null, 'Water'], [null, 'Zobo']], required: true)],
            'a draft choice added' => ['POST', $this->dishPath($this->jollof) . '/choices', self::asked('', [], required: false)],
            'variants added to the default' => ['POST', $this->dishPath($this->jollof) . '/variants', ['variants' => [self::variant('Plate', 'everyone'), self::variant('Kids plate', 'children')]]],
        ];

        foreach ($refused as $edit => [$method, $path, $body]) {
            $this->as($method, $path, $body);
            self::assertSame([409, 'https://soirely.com/errors/menu_is_default', 'Jollof rice is Main’s default. Choose another default first, in Edit course.'], [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['detail'] ?? null], $edit);
        }

        $jollof = $this->dishOf($this->menu(), $this->jollof);
        self::assertSame([[], 1], [$jollof['variants'], Iter\count(Type\vec(Type\mixed())->coerce($jollof['choices']))], 'nothing is saved');

        $hot = $this->choice($this->stew, 'How hot?', true, ['Mild', 'Hot', 'Very hot']);
        [$mild, $spicy, $very] = $this->optionIds($hot);
        $this->changeMain(['dish' => $this->id($this->stew), 'variant' => $this->plate->getId()->toRfc4122(), 'options' => [$mild], 'chooseBy' => '2026-10-10']);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $heat = [[$mild, 'Mild'], [$spicy, 'Hot'], [$very, 'Very hot']];

        $this->as('PUT', $this->choicePath($hot), self::asked('How hot?', [...$heat, [null, 'Extra hot']], required: true, pick: 2));
        self::assertSame([409, 'https://soirely.com/errors/menu_is_default'], [$this->statusCode(), $this->last()['type'] ?? null], 'a new Guests pick exactly');
        $this->as('PUT', '/api/events/' . $this->eventId . '/menu/variants/' . $this->plate->getId()->toRfc4122(), self::variant('Plate', 'children'));
        self::assertSame([409, 'https://soirely.com/errors/menu_is_default'], [$this->statusCode(), $this->last()['type'] ?? null], 'the default variant made Children only');

        $saved = [
            'a finished optional choice added' => ['POST', $this->dishPath($this->stew) . '/choices', self::asked('A sauce?', [[null, 'Ata dindin'], [null, 'Ofada']], required: false)],
            'a new option and a rename' => ['PUT', $this->choicePath($hot), self::asked('How spicy?', [...$heat, [null, 'Extra hot']], required: true)],
            'Required turned off' => ['PUT', $this->choicePath($hot), self::asked('How spicy?', [...$heat], required: false)],
            'a rename of the default variant' => ['PUT', '/api/events/' . $this->eventId . '/menu/variants/' . $this->plate->getId()->toRfc4122(), self::variant('Big plate', 'everyone')],
        ];

        foreach ($saved as $edit => [$method, $path, $body]) {
            $this->as($method, $path, $body);
            self::assertContains($this->statusCode(), [200, 201], $edit . ': ' . Json\encode($this->last()));
        }

        self::assertSame(['dish' => $this->id($this->stew), 'variant' => $this->plate->getId()->toRfc4122(), 'options' => [$mild], 'chooseBy' => '2026-10-10'], $this->mainOf($this->menu())['default']);
    }

    #[Test]
    public function aSendAcrossAClosedCourseAndAnOpenOneSavesTheOpenOne(): void
    {
        $this->starter->setGuestsChoose(true);
        self::em()->persist(new MenuDish($this->starter, null, 'Puff-puff', null, [], [], 1));
        self::em()->flush();
        $soup = $this->id($this->starter, 0);
        $this->as('PUT', '/api/events/' . $this->eventId . '/menu/courses/' . $this->id($this->starter), ['name' => 'Starter', 'answer' => 'choose', 'skippable' => false, 'default' => ['dish' => $soup, 'chooseBy' => '2026-10-05']]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
        $this->changeMain(['dish' => $this->id($this->jollof), 'chooseBy' => '2026-10-10']);
        $this->as('GET', '/api/events/' . $this->eventId . '/timeline');
        $milestones = Type\vec(Type\shape(['at' => Type\string(), 'title' => Type\string()], true))->coerce($this->last()['milestones'] ?? null);
        self::assertSame(['2026-10-05T23:59:59+01:00'], Vec\map(Vec\filter($milestones, static fn (array $one): bool => 'Picks close' === $one['title']), static fn (array $one): string => $one['at']), 'the milestone sits on the earliest course’s close');
        $token = $this->coming([]);
        $bisi = $this->personId('Bisi Adewale');

        self::mockTime(new DateTimeImmutable('2026-10-06T09:00:00+00:00'));
        $closes = Vec\map(Type\vec(Type\shape(['picksClose' => Type\shape(['closed' => Type\bool()], true)], true))->coerce(Type\mixed_dict()->coerce($this->menu()['menu'] ?? null)['courses'] ?? null), static fn (array $course): bool => $course['picksClose']['closed']);
        self::assertSame([true, false], $closes);

        $this->meals($token, [
            ['person' => $bisi, 'course' => $this->id($this->starter), 'answer' => 'chosen', 'dish' => $this->id($this->starter, 1)],
            ['person' => $bisi, 'course' => $this->id($this->main), 'answer' => 'chosen', 'dish' => $this->id($this->suya)],
        ]);

        self::assertSame([409, 'https://soirely.com/errors/meal_picks_closed', [$this->id($this->starter)]], [$this->statusCode(), $this->last()['type'] ?? null, $this->last()['courses'] ?? null]);
        $this->anonymous('/api/guest-links/page', ['token' => $token]);
        $answers = Type\shape(['answers' => Type\dict(Type\string(), Type\vec(Type\shape(['course' => Type\string(), 'answer' => Type\string(), 'dish' => Type\nullable(Type\string())], true)))], true)->coerce($this->last()['meals'] ?? null)['answers'][$bisi] ?? [];
        $main = Iter\search($answers, fn (array $one): bool => $this->id($this->main) === $one['course']);
        self::assertSame(['chosen', $this->id($this->suya)], [$main['answer'] ?? null, $main['dish'] ?? null], 'the open course is saved');
    }

    #[Test]
    public function aCourseThatAsksNothingTakesNoDefault(): void
    {
        $soup = $this->id($this->starter, 0);
        $this->as('PUT', '/api/events/' . $this->eventId . '/menu/courses/' . $this->id($this->starter), ['name' => 'Starter', 'answer' => 'same', 'skippable' => false, 'default' => ['dish' => $soup, 'chooseBy' => '2026-10-10']]);

        self::assertSame(422, $this->statusCode(), Json\encode($this->last()));
    }

    /** @param list<string> $names */
    private function choice(MenuDish $dish, string $question, bool $required, array $names): MenuDishChoice
    {
        $choice = new MenuDishChoice(self::em()->find(MenuDish::class, $dish->getId()) ?? self::fail('no dish'), $question, 1, $required, 0);
        self::em()->persist($choice);

        foreach ($names as $at => $name) {
            self::em()->persist(new MenuChoiceOption($choice, $name, [], $at));
        }

        self::em()->flush();

        return $choice;
    }

    /** @return list<string> in the choice's order */
    private function optionIds(MenuDishChoice $choice): array
    {
        return Type\vec(Type\string())->coerce(self::service(Connection::class)->fetchFirstColumn('SELECT id FROM menu_choice_options WHERE choice_id = :choice ORDER BY position', ['choice' => $choice->getId()->toRfc4122()]));
    }

    /**
     * @param list<array{?string, string}> $options each an id, or null for a new one, and its name
     *
     * @return array<string, mixed>
     */
    private static function asked(string $question, array $options, bool $required, int $pick = 1): array
    {
        return [
            'question' => $question,
            'options' => Vec\map($options, static fn (array $one): array => [...(null === $one[0] ? [] : ['id' => $one[0]]), 'name' => $one[1], 'allergens' => [], 'containsNone' => true]),
            'pick' => $pick,
            'required' => $required,
        ];
    }

    /** @return array<string, mixed> */
    private static function variant(string $name, string $for): array
    {
        return ['name' => $name, 'for' => $for, 'allergens' => [], 'containsNone' => true, 'diets' => ['halal']];
    }

    private function choicePath(MenuDishChoice $choice): string
    {
        return '/api/events/' . $this->eventId . '/menu/choices/' . $choice->getId()->toRfc4122();
    }

    private function dishPath(MenuDish $dish): string
    {
        return '/api/events/' . $this->eventId . '/menu/dishes/' . $this->id($dish);
    }

    /** @return array<string, mixed> */
    private function dishOf(mixed $menu, MenuDish $dish): array
    {
        $dishes = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->mainOf($menu)['dishes'] ?? null);

        return Iter\search($dishes, fn (array $one): bool => $this->id($dish) === ($one['id'] ?? null)) ?? self::fail('no dish');
    }

    /** @return array<string, mixed> */
    private static function resolve(mixed $default, self $test): array
    {
        $ids = ['jollof' => $test->id($test->jollof), 'stew' => $test->id($test->stew), 'kidsPlate' => $test->kidsPlate->getId()->toRfc4122()];

        return Type\dict(Type\string(), Type\mixed())->coerce(Dict\map_with_key(Type\dict(Type\string(), Type\mixed())->coerce($default), static fn (string $key, mixed $value): mixed => \is_string($value) && isset($ids[$value]) && 'chooseBy' !== $key ? $ids[$value] : $value));
    }

    /** @param array<string, mixed> $default */
    private function changeMain(array $default, bool $confirmMove = false): void
    {
        $this->as('PUT', '/api/events/' . $this->eventId . '/menu/courses/' . $this->id($this->main), ['name' => 'Main', 'answer' => 'choose', 'skippable' => false, 'default' => $default, 'confirmMove' => $confirmMove]);
    }

    /** @return array<string, mixed> */
    private function menu(): array
    {
        $this->as('GET', '/api/events/' . $this->eventId . '/menu');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function mainOf(mixed $menu): array
    {
        $courses = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\mixed_dict()->coerce($menu['menu'] ?? null)['courses'] ?? null);

        return Iter\search($courses, fn (array $course): bool => $this->id($this->main) === ($course['id'] ?? null)) ?? self::fail('no main');
    }

    /** @return array<string, mixed> */
    private function picks(): array
    {
        $this->as('GET', '/api/events/' . $this->eventId . '/menu/picks');
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));

        return Type\dict(Type\string(), Type\mixed())->coerce($this->last()['picks'] ?? null);
    }

    /** @param array<string, mixed> $body */
    private function chooseFor(string $person, array $body): void
    {
        $this->as('PUT', '/api/events/' . $this->eventId . '/menu/picks/people/' . $person . '/courses/' . $this->id($this->main), $body);
    }

    /** @return array<string, mixed> */
    private static function course(mixed $picks, string $name): array
    {
        $courses = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\mixed_dict()->coerce($picks)['courses'] ?? null);

        return Iter\search($courses, static fn (array $course): bool => $name === ($course['name'] ?? null)) ?? self::fail('no course ' . $name);
    }

    /** @return array<string, mixed> */
    private static function row(mixed $course, string $name): array
    {
        $rows = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce(Type\mixed_dict()->coerce($course)['rows'] ?? null);

        return Iter\search($rows, static fn (array $row): bool => $name === ($row['name'] ?? null)) ?? self::fail('no row ' . $name);
    }

    /** @return array<string, mixed> */
    private static function waiting(mixed $picks, string $person): array
    {
        $parties = Type\vec(Type\shape(['people' => Type\vec(Type\dict(Type\string(), Type\mixed()))], true))->coerce(Type\mixed_dict()->coerce($picks)['waiting'] ?? null);

        return Iter\search(Vec\flat_map($parties, static fn (array $party): array => $party['people']), static fn (array $one): bool => $person === ($one['id'] ?? null)) ?? self::fail('not waiting');
    }

    private function id(MenuCourse|MenuDish $row, ?int $dish = null): string
    {
        if (null === $dish) {
            return $row->getId()->toRfc4122();
        }

        return Type\string()->coerce(self::service(Connection::class)->fetchOne('SELECT id FROM menu_dishes WHERE course_id = :course ORDER BY position LIMIT 1 OFFSET ' . $dish, ['course' => $row->getId()->toRfc4122()]));
    }

    /** @param list<string> $allergies */
    private function records(string $guestId, array $allergies, string ...$diets): void
    {
        $person = self::em()->find(Guest::class, Uuid::fromString($guestId)) ?? self::fail('no guest');
        $needs = GuestNeeds::none();
        self::service(GuestNeedsRecord::class)->write($person, new GuestNeeds([...$needs->codes, NeedKind::Allergen->value => $allergies, NeedKind::Diet->value => Vec\values($diets)], $needs->others, null), $this->owner);
        self::em()->flush();
    }

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
