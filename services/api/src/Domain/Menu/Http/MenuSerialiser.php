<?php

declare(strict_types=1);

namespace App\Domain\Menu\Http;

use App\Domain\Menu\ChoiceRules;
use App\Domain\Menu\DishRules;
use App\Domain\Menu\Interfaces\MenuPicksInterface;
use App\Entity\Event;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\MenuDishChoice;
use App\Entity\MenuDishVariant;
use App\Locale\NameNormaliser;
use App\Repository\MenuChoiceOptionRepository;
use App\Repository\MenuCourseRepository;
use App\Repository\MenuDishChoiceRepository;
use App\Repository\MenuDishRepository;
use App\Repository\MenuDishVariantRepository;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/** An event's menu as the clients read it (sc-3902): every course in order, each with its dishes, a dish's variants inside it (sc-3903), and its choices (sc-3904). Costs only `$withPrice`, for a reader who holds budget.read. */
final readonly class MenuSerialiser
{
    public function __construct(
        private MenuCourseRepository $menuCourseRepository,
        private MenuDishRepository $menuDishRepository,
        private MenuDishVariantRepository $menuDishVariantRepository,
        private MenuDishChoiceRepository $menuDishChoiceRepository,
        private MenuChoiceOptionRepository $menuChoiceOptionRepository,
        private MenuPicksInterface $menuPicks,
    ) {
    }

    /** @return array{courses: list<array<string, mixed>>} */
    public function menu(Event $event, bool $withPrice = false): array
    {
        $dishes = Dict\group_by($this->menuDishRepository->findOnEvent($event), static fn (MenuDish $dish): string => $dish->getCourse()->getId()->toRfc4122());
        $variants = Dict\group_by($this->menuDishVariantRepository->findOnEvent($event), static fn (MenuDishVariant $variant): string => $variant->getDish()->getId()->toRfc4122());
        $choices = Dict\group_by($this->menuDishChoiceRepository->findOnEvent($event), static fn (MenuDishChoice $choice): string => $choice->getDish()->getId()->toRfc4122());
        $options = Dict\group_by($this->menuChoiceOptionRepository->findOnEvent($event), static fn (MenuChoiceOption $option): string => $option->getChoice()->getId()->toRfc4122());
        $currency = $event->getCurrency();

        return [
            'courses' => Vec\map($this->menuCourseRepository->findOnEvent($event), fn (MenuCourse $course): array => [
                'id' => $course->getId()->toRfc4122(),
                'name' => $course->getName(),
                'servedAt' => $course->getServedAt(),
                'answer' => $course->guestsChoose() ? 'choose' : 'same',
                'skippable' => $course->isSkippable(),
                'ownItems' => $course->getOwnItems(),
                'items' => self::courseItems($course, $dishes[$course->getId()->toRfc4122()] ?? [], $variants, $options),
                'dishes' => Vec\map($dishes[$course->getId()->toRfc4122()] ?? [], fn (MenuDish $dish): array => $this->dish(
                    $dish,
                    $variants[$dish->getId()->toRfc4122()] ?? [],
                    Vec\map($choices[$dish->getId()->toRfc4122()] ?? [], fn (MenuDishChoice $choice): array => $this->choice($choice, $options[$choice->getId()->toRfc4122()] ?? [])),
                    $withPrice ? $currency : null,
                )),
            ]),
        ];
    }

    /**
     * @param list<MenuDishVariant>      $variants
     * @param list<array<string, mixed>> $choices
     *
     * @return array<string, mixed> `allergens` null is never stated, empty is none of the 14; `offered` is false while a draft choice hides it from guests
     */
    private function dish(MenuDish $dish, array $variants, array $choices, ?string $currency): array
    {
        return [
            'id' => $dish->getId()->toRfc4122(),
            'name' => $dish->getName(),
            'description' => $dish->getDescription(),
            'allergens' => $dish->getAllergens(),
            'diets' => $dish->getDiets(),
            'libraryDishId' => $dish->getLibraryDish()?->getId()->toRfc4122(),
            'picked' => [] !== $this->menuPicks->pickersOf($dish),
            'variants' => Vec\map($variants, fn (MenuDishVariant $variant): array => $this->variant($variant, $currency)),
            'choices' => $choices,
            'items' => $dish->getItems(),
            'offered' => Iter\all($choices, static fn (array $choice): bool => false === $choice['draft']),
            ...(null === $currency ? [] : ['cost' => self::money($dish->getCostMinor(), $currency)]),
        ];
    }

    /**
     * @param list<MenuChoiceOption> $options
     *
     * @return array{id: string, question: string, pick: int, required: bool, draft: bool, noneAnswers: int, options: list<array<string, mixed>>}
     */
    private function choice(MenuDishChoice $choice, array $options): array
    {
        return [
            'id' => $choice->getId()->toRfc4122(),
            'question' => $choice->getQuestion(),
            'pick' => $choice->getPick(),
            'required' => $choice->isRequired(),
            'draft' => ChoiceRules::isDraft($choice, Iter\count($options)),
            'noneAnswers' => $this->menuPicks->noneAnswersTo($choice),
            'options' => Vec\map($options, fn (MenuChoiceOption $option): array => [
                'id' => $option->getId()->toRfc4122(),
                'name' => $option->getName(),
                'allergens' => $option->getAllergens(),
                'picks' => Iter\count($this->menuPicks->pickersOfOption($option)),
            ]),
        ];
    }

    /** @return array<string, mixed> `pricedIn` names the library's currency when the copy's cost was left for the host to set */
    private function variant(MenuDishVariant $variant, ?string $currency): array
    {
        return [
            'id' => $variant->getId()->toRfc4122(),
            'name' => $variant->getName(),
            'for' => $variant->isForChildren() ? 'children' : 'everyone',
            'allergens' => $variant->getAllergens(),
            'diets' => $variant->getDiets(),
            'picked' => [] !== $this->menuPicks->pickersOfVariant($variant),
            ...(null === $currency ? [] : ['cost' => self::money($variant->getCostMinor(), $currency), 'pricedIn' => $variant->getPricedIn()]),
        ];
    }

    /**
     * One name is one item on a course, whichever dish or option it comes from: each once, in the order it first appears, the dishes' then the course's own.
     *
     * @param list<MenuDish>                        $dishes   in the menu's order
     * @param array<string, list<MenuDishVariant>>  $variants by dish id
     * @param array<string, list<MenuChoiceOption>> $options  by choice id
     *
     * @return list<string>
     */
    private static function courseItems(MenuCourse $course, array $dishes, array $variants, array $options): array
    {
        $names = [];

        foreach ($dishes as $dish) {
            $items = $dish->getItems();

            if ([] === $items) {
                $names[] = $dish->getName();

                continue;
            }

            foreach ($items as $item) {
                $names = [...$names, ...match ($item['kind']) {
                    'fixed' => [$item['name']],
                    'variants' => Vec\map($variants[$dish->getId()->toRfc4122()] ?? [], static fn (MenuDishVariant $one): string => $one->getName()),
                    'choice' => Vec\map($options[$item['choiceId']] ?? [], static fn (MenuChoiceOption $one): string => $one->getName()),
                }];
            }
        }

        $seen = [];
        $items = [];

        foreach ([...$names, ...$course->getOwnItems()] as $name) {
            $key = NameNormaliser::key($name);

            if (!Iter\contains($seen, $key)) {
                $seen[] = $key;
                $items[] = NameNormaliser::name($name);
            }
        }

        return $items;
    }

    /** @return ?array{amount: string, currency: string} */
    private static function money(?int $minor, string $currency): ?array
    {
        return null === $minor ? null : ['amount' => DishRules::written($minor, $currency), 'currency' => $currency];
    }
}
