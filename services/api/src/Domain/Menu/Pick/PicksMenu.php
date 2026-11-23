<?php

declare(strict_types=1);

namespace App\Domain\Menu\Pick;

use App\Domain\Menu\Http\MenuSerialiser;
use App\Entity\Event;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/**
 * The courses See picks shows (sc-3909): each that asks guests, and each that asks them nothing, sc-3907's one set dish.
 *
 * @phpstan-import-type CourseDefault from MealDefault
 *
 * @phpstan-type Variant array{id: string, name: string, for: string, allergens: list<string>, diets: list<string>, ...}
 * @phpstan-type Option array{id: string, name: string, allergens: list<string>, ...}
 * @phpstan-type Choice array{id: string, question: string, pick: int, required: bool, draft: bool, options: list<Option>, ...}
 * @phpstan-type Dish array{id: string, name: string, allergens: ?list<string>, diets: list<string>, variants: list<Variant>, choices: list<array<array-key, mixed>>, ...}
 * @phpstan-type Course array{id: string, name: string, answer: string, skippable: bool, picksClose: ?array{at: string, source: string, closed: bool}, default: ?CourseDefault, dishes: list<Dish>, ...}
 * @phpstan-type Spot array{state: string, dish?: string, variant?: ?string, options?: list<string>, reason?: string, pick?: string, allergens?: list<string>, notStated?: bool, excluded?: string, picked?: string, why?: string}
 */
final readonly class PicksMenu
{
    public function __construct(
        private MenuSerialiser $menuSerialiser,
    ) {
    }

    /** @return list<Course> */
    public function courses(Event $event): array
    {
        $courses = self::courseType()->coerce($this->menuSerialiser->menu($event)['courses']);

        return Vec\filter($courses, static fn (array $course): bool => null !== $course['picksClose'] || self::asksNothing($course));
    }

    /** @param Course $course */
    public static function asksNothing(array $course): bool
    {
        if (null !== $course['picksClose'] || 'same' !== $course['answer'] || 1 !== Iter\count($course['dishes'])) {
            return false;
        }

        $dish = $course['dishes'][0];

        return [] === $dish['choices'] && Iter\count(Vec\filter($dish['variants'], static fn (array $variant): bool => 'everyone' === $variant['for'])) <= 1;
    }

    /**
     * @param Course       $course
     * @param list<string> $allergens
     *
     * @return ?array{dish: string, variant: ?string} what a person is served on a course that asks nothing, or null when it rules them out
     */
    public static function setPlate(array $course, array $allergens): ?array
    {
        $dish = $course['dishes'][0];
        $everyone = Iter\search($dish['variants'], static fn (array $variant): bool => 'everyone' === $variant['for']);
        $plate = null === $everyone ? $dish['allergens'] : $everyone['allergens'];

        return [] === MealAllergens::against($plate, $allergens) ? ['dish' => $dish['id'], 'variant' => $everyone['id'] ?? null] : null;
    }

    /**
     * @param Course       $course
     * @param list<string> $options
     *
     * @return string the dish, its variant and its picked options, as See picks names a plate; empty for a dish no longer on the course
     */
    public static function plateName(array $course, string $dish, ?string $variant, array $options): string
    {
        $onCourse = Iter\search($course['dishes'], static fn (array $one): bool => $one['id'] === $dish);

        if (null === $onCourse) {
            return '';
        }

        $way = Iter\search($onCourse['variants'], static fn (array $one): bool => $one['id'] === $variant);
        $picked = Vec\filter(Vec\flat_map(self::choices($onCourse), static fn (array $choice): array => $choice['options']), static fn (array $option): bool => Iter\contains($options, $option['id']));

        return Str\join(Vec\filter_nulls([$onCourse['name'], $way['name'] ?? null, ...Vec\map($picked, static fn (array $option): string => $option['name'])]), ', ');
    }

    /** @return list<Choice> */
    public static function choices(mixed $dish): array
    {
        $dish = Type\shape(['choices' => Type\vec(Type\mixed_dict())], true)->coerce($dish);
        $optionType = Type\shape(['id' => Type\string(), 'name' => Type\string(), 'allergens' => Type\vec(Type\string())], true);

        return Type\vec(Type\shape(['id' => Type\string(), 'question' => Type\string(), 'pick' => Type\int(), 'required' => Type\bool(), 'draft' => Type\bool(), 'options' => Type\vec($optionType)], true))->coerce($dish['choices']);
    }

    /** @return Type\TypeInterface<CourseDefault> */
    public static function defaultType(): Type\TypeInterface
    {
        return Type\shape(['dish' => Type\string(), 'variant' => Type\nullable(Type\string()), 'options' => Type\vec(Type\string()), 'chooseBy' => Type\string()]);
    }

    /** @return Type\TypeInterface<list<Course>> */
    private static function courseType(): Type\TypeInterface
    {
        $variantType = Type\shape(['id' => Type\string(), 'name' => Type\string(), 'for' => Type\string(), 'allergens' => Type\vec(Type\string()), 'diets' => Type\vec(Type\string())], true);
        $dishType = Type\shape([
            'id' => Type\string(),
            'name' => Type\string(),
            'allergens' => Type\nullable(Type\vec(Type\string())),
            'diets' => Type\vec(Type\string()),
            'variants' => Type\vec($variantType),
            'choices' => Type\vec(Type\mixed_dict()),
        ], true);

        return Type\vec(Type\shape([
            'id' => Type\string(),
            'name' => Type\string(),
            'answer' => Type\string(),
            'skippable' => Type\bool(),
            'picksClose' => Type\nullable(Type\shape(['at' => Type\string(), 'source' => Type\string(), 'closed' => Type\bool()])),
            'default' => Type\nullable(self::defaultType()),
            'dishes' => Type\vec($dishType),
        ], true));
    }
}
