<?php

declare(strict_types=1);

namespace App\Domain\Menu\Http;

use App\Domain\Menu\ChoiceRules;
use App\Domain\Menu\CourseItemLister;
use App\Domain\Menu\Interfaces\CourseItemsInterface;
use App\Domain\Menu\Interfaces\MenuPicksInterface;
use App\Domain\Menu\Model\PicksClose;
use App\Entity\Event;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\MenuDishChoice;
use App\Entity\MenuDishVariant;
use App\Locale\Money;
use App\Repository\MenuChoiceOptionRepository;
use App\Repository\MenuCourseRepository;
use App\Repository\MenuDishChoiceRepository;
use App\Repository\MenuDishRepository;
use App\Repository\MenuDishVariantRepository;
use DateTimeZone;
use Psl\Dict;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** An event's menu as the clients read it (sc-3902): every course in order, each with its dishes, a dish's variants inside it (sc-3903), its choices (sc-3904), and when its picks close if it asks guests anything (sc-3905). Costs only `$withPrice`, for a reader who holds budget.read. */
final readonly class MenuSerialiser
{
    public function __construct(
        private MenuCourseRepository $menuCourseRepository,
        private MenuDishRepository $menuDishRepository,
        private MenuDishVariantRepository $menuDishVariantRepository,
        private MenuDishChoiceRepository $menuDishChoiceRepository,
        private MenuChoiceOptionRepository $menuChoiceOptionRepository,
        private MenuPicksInterface $menuPicks,
        private CourseItemsInterface $courseItems,
        private ClockInterface $clock,
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
        $linked = $this->courseItems->linkedTo($event);

        return [
            'courses' => Vec\map($this->menuCourseRepository->findOnEvent($event), fn (MenuCourse $course): array => self::withClose([
                'id' => $course->getId()->toRfc4122(),
                'name' => $course->getName(),
                'servedAt' => $course->getServedAt(),
                'scheduleItem' => $linked[$course->getId()->toRfc4122()] ?? null,
                'answer' => $course->guestsChoose() ? 'choose' : 'same',
                'skippable' => $course->isSkippable(),
                'ownItems' => $course->getOwnItems(),
                'items' => CourseItemLister::items($course, $dishes[$course->getId()->toRfc4122()] ?? [], $variants, $options),
                'dishes' => Vec\map($dishes[$course->getId()->toRfc4122()] ?? [], fn (MenuDish $dish): array => $this->dish(
                    $dish,
                    $variants[$dish->getId()->toRfc4122()] ?? [],
                    Vec\map($choices[$dish->getId()->toRfc4122()] ?? [], fn (MenuDishChoice $choice): array => $this->choice($choice, $options[$choice->getId()->toRfc4122()] ?? [])),
                    $withPrice ? $currency : null,
                )),
                'default' => self::defaultOf($course),
            ], $this->close($event, $course))),
        ];
    }

    /** @return array{at: string, source: string, closed: bool} in the event's zone */
    private function close(Event $event, MenuCourse $course): array
    {
        $close = PicksClose::of($event, $course);

        return [
            'at' => $close->at->setTimezone(new DateTimeZone($event->getTimeZone()))->format(\DATE_ATOM),
            'source' => $close->source->value,
            'closed' => $close->passedAt($this->clock->now()),
        ];
    }

    /**
     * A course asks guests something when it is shown to them and they choose, or its one dish asks the way (two or more Everyone variants) or a choice. Only such a course closes.
     *
     * @param array{answer: string, dishes: list<array<string, mixed>>, default: mixed, ...} $course
     * @param array{at: string, source: string, closed: bool}                                $close
     *
     * @return array<string, mixed>
     */
    private static function withClose(array $course, array $close): array
    {
        $dishes = Type\vec(Type\shape(['offered' => Type\bool(), 'choices' => Type\vec(Type\mixed()), 'variants' => Type\vec(Type\shape(['for' => Type\string()], true))], true))->coerce($course['dishes']);
        $shown = Iter\any($dishes, static fn (array $dish): bool => $dish['offered']);
        $one = 1 === Iter\count($dishes) ? $dishes[0] : null;
        $asks = 'choose' === $course['answer']
            || (null !== $one && ([] !== $one['choices'] || Iter\count(Vec\filter($one['variants'], static fn (array $variant): bool => 'everyone' === $variant['for'])) >= 2));

        return $shown && $asks ? [...$course, 'picksClose' => $close] : [...$course, 'picksClose' => null, 'default' => null];
    }

    /** @return ?array{dish: string, variant: ?string, options: list<string>, chooseBy: string} the whole pick given at the choose-by date (sc-1362) */
    private static function defaultOf(MenuCourse $course): ?array
    {
        $dish = $course->getDefaultDish();
        $chooseBy = $course->getChooseBy();

        if (null === $dish || null === $chooseBy) {
            return null;
        }

        return [
            'dish' => $dish->getId()->toRfc4122(),
            'variant' => $course->getDefaultVariant()?->getId()->toRfc4122(),
            'options' => $course->getDefaultOptions(),
            'chooseBy' => $chooseBy->format('Y-m-d'),
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

    /** @return ?array{amount: string, currency: string} */
    private static function money(?int $minor, string $currency): ?array
    {
        return null === $minor ? null : ['amount' => Money::written($minor, $currency), 'currency' => $currency];
    }
}
