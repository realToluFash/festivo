<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Audit\Auditor;
use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Menu\Http\MenuSerialiser;
use App\Domain\Menu\Interfaces\MenuPicksInterface;
use App\Domain\Menu\Model\ChoiceAnswers;
use App\Domain\Menu\Model\CourseDetails;
use App\Domain\Menu\Model\DishDetails;
use App\Domain\Menu\Model\DishItems;
use App\Domain\Menu\Model\OptionDetails;
use App\Domain\Menu\Model\OwnItems;
use App\Domain\Menu\Model\UnwarnedOption;
use App\Domain\Menu\Model\UnwarnedPickers;
use App\Entity\Dish;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\MenuDishChoice;
use App\Entity\MenuDishVariant;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\NeedKind;
use App\Enum\RealtimeTopic;
use App\Http\Exception\ApiException;
use App\Realtime\RealtimePublisher;
use App\Repository\DishVariantRepository;
use App\Repository\MenuChoiceOptionRepository;
use App\Repository\MenuCourseRepository;
use App\Repository\MenuDishChoiceRepository;
use App\Repository\MenuDishRepository;
use App\Repository\MenuDishVariantRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Math;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** Each change runs under a lock on the event's row, so two pages adding together cannot both pass the limit, and is published whole to the event's menu topic (sc-3902). */
final readonly class MenuEditor
{
    public const string COURSE_ADDED = 'menu.course_added';

    public const string COURSE_CHANGED = 'menu.course_changed';

    public const string COURSE_MOVED = 'menu.course_moved';

    public const string COURSE_DELETED = 'menu.course_deleted';

    public const string DISH_ADDED = 'menu.dish_added';

    public const string DISH_CHANGED = 'menu.dish_changed';

    public const string DISH_REMOVED = 'menu.dish_removed';

    public const string VARIANT_ADDED = 'menu.variant_added';

    public const string VARIANT_CHANGED = 'menu.variant_changed';

    public const string VARIANT_REMOVED = 'menu.variant_removed';

    public const string DISH_FOLDED = 'menu.dish_folded';

    public const string CHOICE_ADDED = 'menu.choice_added';

    public const string CHOICE_CHANGED = 'menu.choice_changed';

    public const string CHOICE_REMOVED = 'menu.choice_removed';

    public function __construct(
        private MenuCourseRepository $menuCourseRepository,
        private MenuDishRepository $menuDishRepository,
        private MenuDishVariantRepository $menuDishVariantRepository,
        private MenuDishChoiceRepository $menuDishChoiceRepository,
        private MenuChoiceOptionRepository $menuChoiceOptionRepository,
        private ChoiceRules $choiceRules,
        private DishVariantRepository $dishVariantRepository,
        private VariantRules $variantRules,
        private MenuPicksInterface $menuPicks,
        private MenuSerialiser $menuSerialiser,
        private GuestNeedsRecord $guestNeedsRecord,
        private DishLibrary $dishLibrary,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private RealtimePublisher $realtimePublisher,
    ) {
    }

    public function addCourse(Event $event, CourseDetails $details, User $by): MenuCourse
    {
        $course = $this->locked($event, function () use ($event, $details, $by): MenuCourse {
            $courses = $this->menuCourseRepository->findOnEvent($event);

            if (Iter\count($courses) >= MenuCourse::PER_EVENT_MAXIMUM) {
                throw new ApiException(ErrorCode::MenuCourseLimit, 'menu.course_limit', parameters: ['{max}' => MenuCourse::PER_EVENT_MAXIMUM]);
            }

            $course = new MenuCourse($event, $details->name, $details->servedAt, Iter\count($courses));
            $this->entityManager->persist($course);
            $this->audit(self::COURSE_ADDED, 'MenuCourse', $course->getId(), $by, Auditor::diff([], self::recordedCourse($course)));

            return $course;
        });

        $this->published($event);

        return $course;
    }

    /** Everyone gets the same (`$guestsChoose` false) is refused 409 `menu_same_one_dish` unless the course has exactly one dish. */
    public function changeCourse(Event $event, MenuCourse $course, CourseDetails $details, bool $guestsChoose, bool $skippable, ?OwnItems $ownItems, User $by): void
    {
        $this->locked($event, function () use ($course, $details, $guestsChoose, $skippable, $ownItems, $by): void {
            $this->entityManager->refresh($course);

            if (!$guestsChoose && 1 !== Iter\count($this->menuDishRepository->findOnCourse($course))) {
                throw new ApiException(ErrorCode::MenuSameOneDish, 'menu.same_one_dish');
            }

            $before = self::recordedCourse($course);
            $course->describe($details->name, $details->servedAt);
            $course->setGuestsChoose($guestsChoose);
            $course->setSkippable($skippable);

            if (null !== $ownItems) {
                $course->listOwnItems($ownItems->names);
            }

            $changes = Auditor::diff($before, self::recordedCourse($course));

            if ([] !== $changes) {
                $this->audit(self::COURSE_CHANGED, 'MenuCourse', $course->getId(), $by, $changes);
            }
        });

        $this->published($event);
    }

    public function moveCourse(Event $event, MenuCourse $course, int $to, User $by): void
    {
        $this->locked($event, function () use ($event, $course, $to, $by): void {
            $courses = Vec\filter($this->menuCourseRepository->findOnEvent($event), static fn (MenuCourse $one): bool => $one !== $course);
            $to = Type\uint()->coerce(Math\clamp($to, 0, Iter\count($courses)));
            $from = $course->getPosition();
            $ordered = Vec\concat(Vec\slice($courses, 0, $to), [$course], Vec\slice($courses, $to));

            foreach ($ordered as $position => $one) {
                $one->setPosition($position);
            }

            if ($from !== $to) {
                $this->audit(self::COURSE_MOVED, 'MenuCourse', $course->getId(), $by, ['position' => [$from + 1, $to + 1]]);
            }
        });

        $this->published($event);
    }

    /** Refused 409 `menu_course_picked` once anyone has picked from it, until sc-3913. Its dishes go with it. */
    public function deleteCourse(Event $event, MenuCourse $course, User $by): void
    {
        $this->locked($event, function () use ($event, $course, $by): void {
            $dishes = $this->menuDishRepository->findOnCourse($course);

            if (Iter\any($dishes, $this->dishPicked(...))) {
                throw new ApiException(ErrorCode::MenuCoursePicked, 'menu.course_picked');
            }

            foreach ($dishes as $dish) {
                $this->entityManager->remove($dish);
            }

            $this->audit(self::COURSE_DELETED, 'MenuCourse', $course->getId(), $by, Auditor::diff(self::recordedCourse($course), []));
            $this->entityManager->remove($course);
            $this->entityManager->flush();

            foreach (Vec\values($this->menuCourseRepository->findOnEvent($event)) as $position => $one) {
                $one->setPosition($position);
            }
        });

        $this->published($event);
    }

    /** Marks the library dish used, so the library archives it rather than deleting it. */
    public function addFromLibrary(Event $event, MenuCourse $course, Dish $dish, User $by): MenuDish
    {
        return $this->addDish($event, $course, $by, function (int $position) use ($event, $course, $dish): MenuDish {
            if (null !== $this->menuDishRepository->findOneBy(['course' => $course, 'libraryDish' => $dish])) {
                throw new ApiException(ErrorCode::MenuDishOnCourse, 'menu.dish_on_course');
            }

            $dish->setUsedByEvent(true);
            $copy = MenuDish::copyOf($dish, $course, $position);

            foreach ($this->dishVariantRepository->findOnDish($dish) as $variant) {
                $this->entityManager->persist(MenuDishVariant::copyOf($variant, $copy, $event->getCurrency()));
            }

            return $copy;
        });
    }

    public function addNew(Event $event, MenuCourse $course, DishDetails $details, bool $onlyHere, bool $allowShared, User $by): MenuDish
    {
        return $this->addDish($event, $course, $by, function (int $position) use ($event, $course, $details, $onlyHere, $allowShared, $by): MenuDish {
            if ($onlyHere) {
                return new MenuDish($course, null, $details->name, $details->description, $details->allergens, $details->diets, $position);
            }

            $dish = $this->dishLibrary->add($event->getOrganisation(), $details, $by, $allowShared);
            $dish->setUsedByEvent(true);

            return MenuDish::copyOf($dish, $course, $position);
        });
    }

    public function changeDish(Event $event, MenuDish $dish, DishDetails $details, ?DishItems $items, User $by): ?UnwarnedPickers
    {
        $unwarned = $this->locked($event, function () use ($dish, $details, $items, $by): ?UnwarnedPickers {
            $this->entityManager->refresh($dish);
            $before = self::recordedDish($dish);

            $plain = [] === $this->menuDishVariantRepository->findOnDish($dish);

            if (null !== $items) {
                $dish->listItems($items->items);
            }

            $added = $plain ? Vec\filter($details->allergens, static fn (string $code): bool => !Iter\contains($dish->getAllergens() ?? [], $code)) : [];

            if ($plain) {
                $dish->describe($details->name, $details->description, $details->allergens, $details->diets);
            } else {
                $dish->rename($details->name, $details->description);
            }

            $changes = Auditor::diff($before, self::recordedDish($dish));

            if ([] !== $changes) {
                $this->audit(self::DISH_CHANGED, 'MenuDish', $dish->getId(), $by, $changes);
            }

            return [] === $added ? null : $this->unwarned($this->menuPicks->pickersOf($dish), $added);
        });

        $this->published($event);

        return $unwarned;
    }

    public function removeDish(Event $event, MenuDish $dish, User $by): void
    {
        $this->locked($event, function () use ($dish, $by): void {
            if ($this->dishPicked($dish)) {
                throw new ApiException(ErrorCode::MenuDishPicked, 'menu.dish_picked');
            }

            $course = $dish->getCourse();
            $this->audit(self::DISH_REMOVED, 'MenuDish', $dish->getId(), $by, Auditor::diff(self::recordedDish($dish), []));
            $this->entityManager->remove($dish);
            $this->entityManager->flush();
            self::keepAnswerHonest($course, Iter\count($this->menuDishRepository->findOnCourse($course)));
        });

        $this->published($event);
    }

    /** @param list<array{name: string, for: 'everyone'|'children', allergens?: list<string>, containsNone?: bool, diets?: list<string>, cost?: ?string, lastPrice?: ?array{amount: string, currency: string}}> $sent */
    public function addVariants(Event $event, MenuDish $dish, array $sent, User $by): void
    {
        $this->locked($event, function () use ($event, $dish, $sent, $by): void {
            $this->entityManager->refresh($dish);
            $variants = $this->menuDishVariantRepository->findOnDish($dish);
            $this->variantRules->refuseCount(Iter\count($variants), Iter\count($sent));

            if ([] === $variants && [] !== $this->menuPicks->pickersOf($dish)) {
                throw new ApiException(ErrorCode::MenuDishPicked, 'menu.dish_picked');
            }

            $details = $this->variantRules->details($sent, $variants, $event->getCurrency());

            if ([] === $variants && null !== $dish->getCostMinor()) {
                $before = self::recordedDish($dish);
                $dish->takeVariants();
                $this->audit(self::DISH_CHANGED, 'MenuDish', $dish->getId(), $by, Auditor::diff($before, self::recordedDish($dish)));
            }

            $next = [] === $variants ? 0 : Math\max(Vec\map($variants, static fn (MenuDishVariant $one): int => $one->getPosition())) + 1;
            foreach ($details as $at => $one) {
                $variant = new MenuDishVariant($dish, $one->name, $one->forChildren, $one->allergens, $one->diets, $one->price?->minor, $next + $at);
                $this->entityManager->persist($variant);
                $this->audit(self::VARIANT_ADDED, 'MenuDishVariant', $variant->getId(), $by, Auditor::diff([], self::recordedVariant($variant)));
            }
        });

        $this->published($event);
    }

    /** @param array{name: string, for: 'everyone'|'children', allergens?: list<string>, containsNone?: bool, diets?: list<string>, cost?: ?string, lastPrice?: ?array{amount: string, currency: string}} $sent */
    public function changeVariant(Event $event, MenuDishVariant $variant, array $sent, bool $withCost, User $by): ?UnwarnedPickers
    {
        $unwarned = $this->locked($event, function () use ($event, $variant, $sent, $withCost, $by): ?UnwarnedPickers {
            $this->entityManager->refresh($variant);
            $others = Vec\filter($this->menuDishVariantRepository->findOnDish($variant->getDish()), static fn (MenuDishVariant $one): bool => $one !== $variant);
            $details = $this->variantRules->details([$sent], Vec\values($others), $event->getCurrency())[0];
            $before = self::recordedVariant($variant);
            $added = Vec\filter($details->allergens, static fn (string $code): bool => !Iter\contains($variant->getAllergens(), $code));
            $variant->describe($details->name, $details->forChildren, $details->allergens, $details->diets);

            if ($withCost) {
                $variant->setCostMinor($details->price?->minor);
            }

            $changes = Auditor::diff($before, self::recordedVariant($variant));

            if ([] !== $changes) {
                $this->audit(self::VARIANT_CHANGED, 'MenuDishVariant', $variant->getId(), $by, $changes);
            }

            return [] === $added ? null : $this->unwarned($this->menuPicks->pickersOfVariant($variant), $added);
        });

        $this->published($event);

        return $unwarned;
    }

    /** Removing one of two folds the other into the dish: a Children only variant then serves every guest. */
    public function removeVariant(Event $event, MenuDishVariant $variant, User $by): void
    {
        $this->locked($event, function () use ($variant, $by): void {
            $dish = $variant->getDish();
            $left = Vec\filter($this->menuDishVariantRepository->findOnDish($dish), static fn (MenuDishVariant $one): bool => $one !== $variant);

            $folding = 1 === Iter\count($left);
            $picked = $folding ? [$variant, ...$left] : [$variant];

            if (Iter\any($picked, fn (MenuDishVariant $one): bool => [] !== $this->menuPicks->pickersOfVariant($one))) {
                throw new ApiException(ErrorCode::VariantPicked, 'menu.variant_picked');
            }

            if (Iter\count($left) >= 2 && !$variant->isForChildren() && Iter\all($left, static fn (MenuDishVariant $one): bool => $one->isForChildren())) {
                throw new ApiException(ErrorCode::VariantLastEveryone, 'menu.variant_last_everyone', parameters: ['{variant}' => $variant->getName()]);
            }

            $this->audit(self::VARIANT_REMOVED, 'MenuDishVariant', $variant->getId(), $by, Auditor::diff(self::recordedVariant($variant), []));
            $this->entityManager->remove($variant);

            if ($folding) {
                $staying = Vec\values($left)[0];
                $before = self::recordedDish($dish);
                $dish->foldFrom($staying);
                $dish->dropItem(null);
                $this->audit(self::DISH_FOLDED, 'MenuDish', $dish->getId(), $by, Auditor::diff($before, [...self::recordedDish($dish), 'from' => $staying->getName()]));
                $this->entityManager->remove($staying);
            }
        });

        $this->published($event);
    }

    /** @param array{question: string, options: list<array{id?: string, name: string, allergens?: list<string>, containsNone?: bool}>, pick: int, required: bool} $sent refused 409 `choice_limit` at 3, and `menu_dish_picked` on a picked dish until sc-3913 */
    public function addChoice(Event $event, MenuDish $dish, array $sent, User $by): MenuDishChoice
    {
        $choice = $this->locked($event, function () use ($dish, $sent, $by): MenuDishChoice {
            $this->entityManager->refresh($dish);
            $choices = $this->menuDishChoiceRepository->findOnDish($dish);

            if (Iter\count($choices) >= MenuDishChoice::PER_DISH_MAXIMUM) {
                throw new ApiException(ErrorCode::ChoiceLimit, 'menu.choice_limit', parameters: ['{max}' => MenuDishChoice::PER_DISH_MAXIMUM]);
            }

            if ($this->dishPicked($dish)) {
                throw new ApiException(ErrorCode::MenuDishPicked, 'menu.dish_picked');
            }

            $details = $this->choiceRules->details($sent, null, [], null);
            $next = [] === $choices ? 0 : Math\max(Vec\map($choices, static fn (MenuDishChoice $one): int => $one->getPosition())) + 1;
            $choice = new MenuDishChoice($dish, $details->question, $details->pick, $details->required, $next);
            $this->entityManager->persist($choice);

            foreach ($details->options as $at => $one) {
                $this->entityManager->persist(new MenuChoiceOption($choice, $one->name, $one->allergens, $at));
            }

            $this->audit(self::CHOICE_ADDED, 'MenuDishChoice', $choice->getId(), $by, Auditor::diff([], self::recordedChoice($choice, $details->options)));

            return $choice;
        });

        $this->published($event);

        return $choice;
    }

    /**
     * @param array{question: string, options: list<array{id?: string, name: string, allergens?: list<string>, containsNone?: bool}>, pick: int, required: bool} $sent an answered choice refuses, until sc-3913, what would leave an answer outside it
     *
     * @return list<UnwarnedOption> in the choice's order
     */
    public function changeChoice(Event $event, MenuDishChoice $choice, array $sent, User $by): array
    {
        $unwarned = $this->locked($event, function () use ($choice, $sent, $by): array {
            $this->entityManager->refresh($choice);
            $options = $this->menuChoiceOptionRepository->findOnChoice($choice);
            $details = $this->choiceRules->details($sent, $choice, $options, $this->answersTo($choice, $options));
            $before = self::recordedChoice($choice, $options);
            $byId = Dict\reindex($options, static fn (MenuChoiceOption $one): string => $one->getId()->toRfc4122());
            $kept = Vec\filter_nulls(Vec\map($details->options, static fn (OptionDetails $one): ?string => $one->id));
            $lines = [];

            foreach ($options as $one) {
                if (!Iter\contains($kept, $one->getId()->toRfc4122())) {
                    $this->entityManager->remove($one);
                }
            }

            $choice->ask($details->question, $details->pick, $details->required);

            foreach ($details->options as $at => $one) {
                $option = null === $one->id ? null : $byId[$one->id];

                if (null === $option) {
                    $this->entityManager->persist(new MenuChoiceOption($choice, $one->name, $one->allergens, $at));

                    continue;
                }

                $added = Vec\filter($one->allergens, static fn (string $code): bool => !Iter\contains($option->getAllergens(), $code));
                $option->describe($one->name, $one->allergens, $at);
                $pickers = [] === $added ? null : $this->unwarned($this->menuPicks->pickersOfOption($option), $added);

                if (null !== $pickers) {
                    $lines[] = new UnwarnedOption($option->getId()->toRfc4122(), $option->getName(), $pickers);
                }
            }

            $changes = Auditor::diff($before, self::recordedChoice($choice, $details->options));

            if ([] !== $changes) {
                $this->audit(self::CHOICE_CHANGED, 'MenuDishChoice', $choice->getId(), $by, $changes);
            }

            return $lines;
        });

        $this->published($event);

        return $unwarned;
    }

    public function removeChoice(Event $event, MenuDishChoice $choice, User $by): void
    {
        $this->locked($event, function () use ($choice, $by): void {
            $options = $this->menuChoiceOptionRepository->findOnChoice($choice);

            if ($this->answersTo($choice, $options)->answered()) {
                throw new ApiException(ErrorCode::ChoiceAnswered, 'menu.choice_answered');
            }

            $this->audit(self::CHOICE_REMOVED, 'MenuDishChoice', $choice->getId(), $by, Auditor::diff(self::recordedChoice($choice, $options), []));
            $dish = $choice->getDish();
            $id = $choice->getId()->toRfc4122();
            $before = self::recordedDish($dish);
            $dish->dropItem($id);
            $changes = Auditor::diff($before, self::recordedDish($dish));

            if ([] !== $changes) {
                $this->audit(self::DISH_CHANGED, 'MenuDish', $dish->getId(), $by, $changes);
            }

            $this->entityManager->remove($choice);
        });

        $this->published($event);
    }

    /** @param list<MenuChoiceOption> $options */
    private function answersTo(MenuDishChoice $choice, array $options): ChoiceAnswers
    {
        $picked = Vec\filter($options, fn (MenuChoiceOption $one): bool => [] !== $this->menuPicks->pickersOfOption($one));

        return new ChoiceAnswers(Vec\map($picked, static fn (MenuChoiceOption $one): string => $one->getId()->toRfc4122()), $this->menuPicks->noneAnswersTo($choice));
    }

    /** The one count Remove, Delete course and Add a choice refuse on: the dish's picks, a variant's, or an answer to one of its choices. */
    private function dishPicked(MenuDish $dish): bool
    {
        return [] !== $this->menuPicks->pickersOf($dish)
            || Iter\any($this->menuDishVariantRepository->findOnDish($dish), fn (MenuDishVariant $one): bool => [] !== $this->menuPicks->pickersOfVariant($one))
            || Iter\any($this->menuDishChoiceRepository->findOnDish($dish), fn (MenuDishChoice $one): bool => $this->answersTo($one, $this->menuChoiceOptionRepository->findOnChoice($one))->answered());
    }

    /** @param callable(int): MenuDish $made */
    private function addDish(Event $event, MenuCourse $course, User $by, callable $made): MenuDish
    {
        $dish = $this->locked($event, function () use ($course, $by, $made): MenuDish {
            $this->entityManager->refresh($course);
            $onCourse = $this->menuDishRepository->findOnCourse($course);
            $dish = $made(0 === Iter\count($onCourse) ? 0 : Math\max(Vec\map($onCourse, static fn (MenuDish $one): int => $one->getPosition())) + 1);
            $this->entityManager->persist($dish);
            self::keepAnswerHonest($course, Iter\count($onCourse) + 1);
            $this->audit(self::DISH_ADDED, 'MenuDish', $dish->getId(), $by, Auditor::diff([], self::recordedDish($dish)));

            return $dish;
        });

        $this->published($event);

        return $dish;
    }

    private static function keepAnswerHonest(MenuCourse $course, int $dishes): void
    {
        if (!$course->guestsChoose() && 1 !== $dishes) {
            $course->setGuestsChoose(true);
        }
    }

    /**
     * @param list<Guest>  $pickers
     * @param list<string> $added   an Other allergy is words, never a code, so it never matches one
     */
    private function unwarned(array $pickers, array $added): ?UnwarnedPickers
    {
        if ([] === $pickers) {
            return null;
        }

        $recorded = Vec\map(Vec\values($this->guestNeedsRecord->of($pickers)), static fn ($needs): array => $needs->codesOf(NeedKind::Allergen));
        $counted = Vec\filter($recorded, static fn (array $codes): bool => Iter\any($added, static fn (string $code): bool => Iter\contains($codes, $code)));

        if ([] === $counted) {
            return null;
        }

        $named = Vec\filter(DishRules::allergenCodes(), static fn (string $code): bool => Iter\contains($added, $code) && Iter\any($counted, static fn (array $codes): bool => Iter\contains($codes, $code)));

        return new UnwarnedPickers(Iter\count($counted), Type\non_empty_vec(Type\string())->coerce($named));
    }

    /**
     * @template T
     *
     * @param callable(): T $change
     *
     * @return T
     */
    private function locked(Event $event, callable $change): mixed
    {
        return $this->entityManager->wrapInTransaction(function () use ($event, $change): mixed {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $changed = $change();
            $this->entityManager->flush();

            return $changed;
        });
    }

    private function published(Event $event): void
    {
        $this->realtimePublisher->publish(RealtimeTopic::EventMenu, $event->getId()->toRfc4122(), $this->menuSerialiser->menu($event));
    }

    /** @return array<string, mixed> */
    private static function recordedVariant(MenuDishVariant $variant): array
    {
        return [
            'dish' => $variant->getDish()->getName(),
            'name' => $variant->getName(),
            'for' => $variant->isForChildren() ? 'children' : 'everyone',
            'allergens' => $variant->getAllergens(),
            'diets' => $variant->getDiets(),
            'cost' => $variant->getCostMinor(),
        ];
    }

    /**
     * @param list<MenuChoiceOption|OptionDetails> $options
     *
     * @return array<string, mixed>
     */
    private static function recordedChoice(MenuDishChoice $choice, array $options): array
    {
        return [
            'dish' => $choice->getDish()->getName(),
            'question' => $choice->getQuestion(),
            'options' => Vec\map($options, static fn (MenuChoiceOption|OptionDetails $one): array => $one instanceof MenuChoiceOption
                ? ['name' => $one->getName(), 'allergens' => $one->getAllergens()]
                : ['name' => $one->name, 'allergens' => $one->allergens]),
            'pick' => $choice->getPick(),
            'required' => $choice->isRequired(),
        ];
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function audit(string $action, string $subject, Uuid $id, User $by, array $changes): void
    {
        $this->auditor->record($action, $subject, $id, Actor::User, $by->getId(), $by->getName(), $changes);
    }

    /** @return array<string, mixed> */
    private static function recordedCourse(MenuCourse $course): array
    {
        return [
            'name' => $course->getName(),
            'servedAt' => $course->getServedAt(),
            'answer' => $course->guestsChoose() ? 'choose' : 'same',
            'skippable' => $course->isSkippable(),
            'ownItems' => $course->getOwnItems(),
        ];
    }

    /** @return array<string, mixed> */
    private static function recordedDish(MenuDish $dish): array
    {
        return [
            'name' => $dish->getName(),
            'description' => $dish->getDescription(),
            'allergens' => $dish->getAllergens(),
            'diets' => $dish->getDiets(),
            'cost' => $dish->getCostMinor(),
            'items' => $dish->getItems(),
        ];
    }
}
