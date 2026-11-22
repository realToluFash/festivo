<?php

declare(strict_types=1);

namespace App\Domain\Menu\Pick;

use App\Domain\Menu\Http\MenuSerialiser;
use App\Entity\Event;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;

/**
 * @phpstan-type Sent array{person: string, course: string, answer: string, dish?: ?string, variant?: ?string, options?: list<string>}
 * @phpstan-type GuestOption array{id: string, name: string, allergens: list<string>}
 * @phpstan-type GuestChoice array{id: string, question: string, pick: int, required: bool, options: list<GuestOption>}
 * @phpstan-type GuestVariant array{id: string, name: string, allergens: list<string>, diets: list<string>}
 * @phpstan-type GuestDish array{id: string, name: string, description: ?string, allergens: ?list<string>, diets: list<string>, variants: list<GuestVariant>, choices: list<GuestChoice>}
 * @phpstan-type GuestCourse array{id: string, name: string, answer: string, skippable: bool, picksClose: array{at: string, source: string, closed: bool}, dishes: list<GuestDish>}
 */
final readonly class GuestMenu
{
    public function __construct(
        private MenuSerialiser $menuSerialiser,
    ) {
    }

    /** @return list<GuestCourse> each course that asks, with only what a guest is offered (sc-3907) */
    public function menu(Event $event): array
    {
        $courses = Type\vec(Type\shape([
            'id' => Type\string(),
            'name' => Type\string(),
            'answer' => Type\string(),
            'skippable' => Type\bool(),
            'picksClose' => Type\nullable(Type\shape(['at' => Type\string(), 'source' => Type\string(), 'closed' => Type\bool()])),
            'dishes' => Type\vec(Type\mixed_dict()),
        ], true))->coerce($this->menuSerialiser->menu($event)['courses']);
        $dishShape = Type\shape([
            'id' => Type\string(),
            'name' => Type\string(),
            'description' => Type\nullable(Type\string()),
            'allergens' => Type\nullable(Type\vec(Type\string())),
            'diets' => Type\vec(Type\string()),
            'offered' => Type\bool(),
            'variants' => Type\vec(Type\mixed_dict()),
            'choices' => Type\vec(Type\mixed_dict()),
        ], true);
        $variantShape = Type\shape(['id' => Type\string(), 'name' => Type\string(), 'for' => Type\string(), 'allergens' => Type\vec(Type\string()), 'diets' => Type\vec(Type\string())], true);
        $choiceShape = Type\shape(['id' => Type\string(), 'question' => Type\string(), 'pick' => Type\int(), 'required' => Type\bool(), 'draft' => Type\bool(), 'options' => Type\vec(Type\mixed_dict())], true);
        $optionShape = Type\shape(['id' => Type\string(), 'name' => Type\string(), 'allergens' => Type\vec(Type\string())], true);

        $asked = [];

        foreach ($courses as $course) {
            $close = $course['picksClose'];
            $dishes = [];

            foreach ($course['dishes'] as $sent) {
                $dish = $dishShape->coerce($sent);

                if (!$dish['offered']) {
                    continue;
                }

                $variants = [];

                foreach ($dish['variants'] as $way) {
                    $variant = $variantShape->coerce($way);

                    if ('everyone' === $variant['for']) {
                        $variants[] = ['id' => $variant['id'], 'name' => $variant['name'], 'allergens' => $variant['allergens'], 'diets' => $variant['diets']];
                    }
                }

                $choices = [];

                foreach ($dish['choices'] as $asks) {
                    $choice = $choiceShape->coerce($asks);

                    if ($choice['draft']) {
                        continue;
                    }

                    $choices[] = [
                        'id' => $choice['id'],
                        'question' => $choice['question'],
                        'pick' => $choice['pick'],
                        'required' => $choice['required'],
                        'options' => Vec\map($choice['options'], static function (array $option) use ($optionShape): array {
                            $known = $optionShape->coerce($option);

                            return ['id' => $known['id'], 'name' => $known['name'], 'allergens' => $known['allergens']];
                        }),
                    ];
                }

                $dishes[] = [
                    'id' => $dish['id'],
                    'name' => $dish['name'],
                    'description' => $dish['description'],
                    'allergens' => $dish['allergens'],
                    'diets' => $dish['diets'],
                    'variants' => $variants,
                    'choices' => $choices,
                ];
            }

            if (null === $close || [] === $dishes) {
                continue;
            }

            $asked[] = [
                'id' => $course['id'],
                'name' => $course['name'],
                'answer' => $course['answer'],
                'skippable' => $course['skippable'],
                'picksClose' => $close,
                'dishes' => $dishes,
            ];
        }

        return $asked;
    }

    /**
     * @param GuestDish    $dish
     * @param list<string> $allergens
     */
    public static function ruledOut(array $dish, array $allergens): bool
    {
        $everyWayOut = [] === $dish['variants']
            ? [] !== MealAllergens::against($dish['allergens'], $allergens)
            : Iter\all($dish['variants'], static fn (array $variant): bool => [] !== MealAllergens::against($variant['allergens'], $allergens));

        if ($everyWayOut) {
            return true;
        }

        return Iter\any($dish['choices'], static fn (array $choice): bool => $choice['required']
            && Iter\count(Vec\filter($choice['options'], static fn (array $option): bool => [] === MealAllergens::against($option['allergens'], $allergens))) < $choice['pick']);
    }
}
