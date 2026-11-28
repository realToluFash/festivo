<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Audit\Auditor;
use App\Domain\Menu\Interfaces\SchedulePublishedInterface;
use App\Domain\Menu\Model\ChoiceDetails;
use App\Domain\Menu\Model\CourseDetails;
use App\Domain\Menu\Model\DishDetails;
use App\Domain\Menu\Model\DishItems;
use App\Domain\Menu\Model\OptionDetails;
use App\Domain\Menu\Model\OwnItems;
use App\Domain\Menu\Model\PicksClose;
use App\Domain\Menu\Model\VariantDetails;
use App\Domain\Menu\Pick\DefaultMoves;
use App\Domain\Menu\Pick\MenuReasks;
use App\Entity\Dish;
use App\Entity\Event;
use App\Entity\MealAnswer;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuCourse;
use App\Entity\MenuDish;
use App\Entity\MenuDishChoice;
use App\Entity\MenuDishVariant;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\MealAnswerKind;
use App\Enum\MenuChangeWhy;
use App\Http\Exception\ApiException;
use App\Repository\DishVariantRepository;
use App\Repository\MenuChoiceOptionRepository;
use App\Repository\MenuCourseRepository;
use App\Repository\MenuDishChoiceRepository;
use App\Repository\MenuDishRepository;
use App\Repository\MenuDishVariantRepository;
use App\Repository\ScheduleItemRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Math;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/**
 * Each change runs under a lock on the event's row, so two pages adding together cannot both pass the limit, and is published whole to the event's menu topic (sc-3902).
 *
 * @phpstan-import-type SentDefault from DefaultRules
 * @phpstan-import-type Asked from MenuReasks
 */
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
        private MenuReasks $menuReasks,
        private MenuPublisher $menuPublisher,
        private DishLibrary $dishLibrary,
        private DefaultRules $defaultRules,
        private DefaultMoves $defaultMoves,
        private ClockInterface $clock,
        private ScheduleItemRepository $scheduleItemRepository,
        private SchedulePublishedInterface $schedulePublished,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
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

        $this->menuPublisher->published($event);

        return $course;
    }

    /**
     * Everyone gets the same (`$guestsChoose` false) is refused 409 `menu_same_one_dish` unless the course has exactly one dish. A linked course's time is its item's: a `$servedAtSent` that differs is refused 409 `menu_course_linked`, and one not sent leaves it.
     *
     * @param ?SentDefault $default null keeps the default and its date (sc-1362); a change after the date that moves anyone is refused 409 `menu_default_move` with `move` and `back` until sent with `$confirmMove`
     */
    public function changeCourse(Event $event, MenuCourse $course, CourseDetails $details, bool $servedAtSent, bool $guestsChoose, bool $skippable, ?OwnItems $ownItems, User $by, ?array $default = null, bool $confirmMove = false): void
    {
        $renamed = false;
        $this->locked($event, function () use ($event, $course, $details, $servedAtSent, $guestsChoose, $skippable, $ownItems, $by, $default, $confirmMove, &$renamed): void {
            $this->entityManager->refresh($course);

            if (!$guestsChoose && 1 !== Iter\count($this->menuDishRepository->findOnCourse($course))) {
                throw new ApiException(ErrorCode::MenuSameOneDish, 'menu.same_one_dish');
            }

            $linked = $this->scheduleItemRepository->findOneByCourse($course);

            if (null !== $linked && $servedAtSent && $details->servedAt !== $course->getServedAt()) {
                throw new ApiException(ErrorCode::MenuCourseLinked, 'menu.course_linked');
            }

            $before = self::recordedCourse($course);
            $course->describe($details->name, $servedAtSent && null === $linked ? $details->servedAt : $course->getServedAt());
            $renamed = null !== $linked && $before['name'] !== $course->getName();
            $course->setGuestsChoose($guestsChoose);
            $course->setSkippable($skippable);

            if (null !== $ownItems) {
                $course->listOwnItems($ownItems->names);
            }

            if (null !== $default) {
                $this->setDefault($event, $course, $default, $confirmMove);
            }

            $changes = Auditor::diff($before, self::recordedCourse($course));

            if ([] !== $changes) {
                $this->audit(self::COURSE_CHANGED, 'MenuCourse', $course->getId(), $by, $changes);
            }
        });

        $this->menuPublisher->published($event);

        if ($renamed) {
            $this->schedulePublished->published($event);
        }
    }

    /** @param SentDefault $sent */
    private function setDefault(Event $event, MenuCourse $course, array $sent, bool $confirmMove): void
    {
        $next = $this->defaultRules->details($event, $course, $sent);
        $was = $course->getDefaultDish();
        $samePick = null !== $next && $was === $next->dish && $course->getDefaultVariant() === $next->variant && Vec\sort($course->getDefaultOptions()) === Vec\sort($next->options);

        if (null !== $next && null !== $was && !$samePick && !$confirmMove && PicksClose::of($event, $course)->passedAt($this->clock->now())) {
            $moves = $this->defaultMoves->of($event, $course->getId()->toRfc4122(), $next->suitableFor());

            if ($moves['move'] + $moves['back'] > 0) {
                throw new ApiException(ErrorCode::MenuDefaultMove, 'menu.default_move', members: $moves);
            }
        }

        if (null === $next) {
            $course->clearDefault();

            return;
        }

        $course->giveByDefault($next->dish, $next->variant, $next->options, $next->chooseBy);
    }

    private static function refuseDefault(MenuDish $dish, ?MenuDishVariant $variant = null, ?MenuChoiceOption $option = null): void
    {
        $course = $dish->getCourse();

        if ($course->getDefaultDish() !== $dish) {
            return;
        }

        if (null === $variant && null === $option) {
            throw new ApiException(ErrorCode::MenuIsDefault, 'menu.default_dish', parameters: ['{dish}' => $dish->getName(), '{course}' => $course->getName()]);
        }

        if (null !== $variant && $course->getDefaultVariant() === $variant) {
            throw new ApiException(ErrorCode::MenuIsDefault, 'menu.default_variant', parameters: ['{variant}' => $variant->getName(), '{course}' => $course->getName()]);
        }

        if (null !== $option && Iter\contains($course->getDefaultOptions(), $option->getId()->toRfc4122())) {
            throw new ApiException(ErrorCode::MenuIsDefault, 'menu.default_option', parameters: ['{option}' => $option->getName(), '{course}' => $course->getName()]);
        }
    }

    private function refuseUnfinishedDefault(Event $event, MenuDish $dish): void
    {
        $course = $dish->getCourse();

        if ($course->getDefaultDish() !== $dish) {
            return;
        }

        $this->entityManager->flush();

        if (!$this->defaultRules->whole($event, $course)) {
            throw new ApiException(ErrorCode::MenuIsDefault, 'menu.default_dish', parameters: ['{dish}' => $dish->getName(), '{course}' => $course->getName()]);
        }
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

        $this->menuPublisher->published($event);
    }

    /** Refused 409 `menu_course_picked` once anyone has picked from it. Its dishes go with it. */
    public function deleteCourse(Event $event, MenuCourse $course, User $by): void
    {
        $linked = false;
        $this->locked($event, function () use ($event, $course, $by, &$linked): void {
            $dishes = $this->menuDishRepository->findOnCourse($course);

            if (Iter\any($dishes, fn (MenuDish $dish): bool => [] !== $this->menuReasks->naming($dish))) {
                throw new ApiException(ErrorCode::MenuCoursePicked, 'menu.course_picked');
            }

            foreach ($dishes as $dish) {
                $this->entityManager->remove($dish);
            }

            $this->audit(self::COURSE_DELETED, 'MenuCourse', $course->getId(), $by, Auditor::diff(self::recordedCourse($course), []));
            $item = $this->scheduleItemRepository->findOneByCourse($course);
            $item?->courseWasRemoved($this->clock->now());
            $linked = null !== $item;
            $this->entityManager->remove($course);
            $this->entityManager->flush();

            foreach (Vec\values($this->menuCourseRepository->findOnEvent($event)) as $position => $one) {
                $one->setPosition($position);
            }
        });

        $this->menuPublisher->published($event);

        if ($linked) {
            $this->schedulePublished->published($event);
        }
    }

    /** Marks the library dish used, so the library archives it rather than deleting it. */
    public function addFromLibrary(Event $event, MenuCourse $course, Dish $dish, User $by, bool $askAgain = false): MenuDish
    {
        return $this->addDish($event, $course, $by, $askAgain, function (int $position) use ($event, $course, $dish): MenuDish {
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

    public function addNew(Event $event, MenuCourse $course, DishDetails $details, bool $onlyHere, bool $allowShared, User $by, bool $askAgain = false): MenuDish
    {
        return $this->addDish($event, $course, $by, $askAgain, function (int $position) use ($event, $course, $details, $onlyHere, $allowShared, $by): MenuDish {
            if ($onlyHere) {
                return new MenuDish($course, null, $details->name, $details->description, $details->allergens, $details->diets, $position);
            }

            $dish = $this->dishLibrary->add($event->getOrganisation(), $details, $by, $allowShared);
            $dish->setUsedByEvent(true);

            return MenuDish::copyOf($dish, $course, $position);
        });
    }

    public function changeDish(Event $event, MenuDish $dish, DishDetails $details, ?DishItems $items, User $by, bool $askAgain = false): void
    {
        $this->locked($event, function () use ($dish, $details, $items, $by, $askAgain): void {
            $this->entityManager->refresh($dish);
            $before = self::recordedDish($dish);

            $plain = [] === $this->menuDishVariantRepository->findOnDish($dish);

            if (null !== $items) {
                $dish->listItems($items->items);
            }

            $added = $plain ? Vec\filter($details->allergens, static fn (string $code): bool => !Iter\contains($dish->getAllergens() ?? [], $code)) : [];
            $this->menuReasks->ask($dish->getCourse(), [$this->menuReasks->withAllergens($this->menuReasks->naming($dish), $added)], $askAgain);

            if ($plain) {
                $dish->describe($details->name, $details->description, $details->allergens, $details->diets);
            } else {
                $dish->rename($details->name, $details->description);
            }

            $changes = Auditor::diff($before, self::recordedDish($dish));

            if ([] !== $changes) {
                $this->audit(self::DISH_CHANGED, 'MenuDish', $dish->getId(), $by, $changes);
            }
        });

        $this->menuPublisher->published($event);
    }

    public function removeDish(Event $event, MenuDish $dish, User $by, bool $askAgain = false): void
    {
        $this->locked($event, function () use ($dish, $by, $askAgain): void {
            self::refuseDefault($dish);
            $this->menuReasks->ask($dish->getCourse(), [['answers' => $this->menuReasks->naming($dish), 'why' => MenuChangeWhy::Removed]], $askAgain);

            $course = $dish->getCourse();
            $this->audit(self::DISH_REMOVED, 'MenuDish', $dish->getId(), $by, Auditor::diff(self::recordedDish($dish), []));
            $this->entityManager->remove($dish);
            $this->entityManager->flush();
            self::keepAnswerHonest($course, Iter\count($this->menuDishRepository->findOnCourse($course)));
        });

        $this->menuPublisher->published($event);
    }

    /** @param list<array{name: string, for: 'everyone'|'children', allergens?: list<string>, containsNone?: bool, diets?: list<string>, cost?: ?string, lastPrice?: ?array{amount: string, currency: string}}> $sent */
    public function addVariants(Event $event, MenuDish $dish, array $sent, User $by, bool $askAgain = false): void
    {
        $this->locked($event, function () use ($event, $dish, $sent, $by, $askAgain): void {
            $this->entityManager->refresh($dish);
            $variants = $this->menuDishVariantRepository->findOnDish($dish);
            $this->variantRules->refuseCount(Iter\count($variants), Iter\count($sent));
            $details = $this->variantRules->details($sent, $variants, $event->getCurrency());
            $course = $dish->getCourse();
            $startsWays = !$course->guestsChoose() && self::oneWay($variants) && !self::oneWay([...$variants, ...$details]);
            $chosen = [] !== $this->menuDishChoiceRepository->findOnDish($dish);

            if ($startsWays && !$chosen) {
                $this->menuReasks->askEveryone($event, $course, $askAgain);
            }

            if ([] === $variants || ($startsWays && $chosen)) {
                $this->menuReasks->ask($course, [['answers' => $this->menuReasks->naming($dish), 'why' => MenuChangeWhy::Ways, 'ways' => Iter\count($details)]], $askAgain);
            }

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

            $this->refuseUnfinishedDefault($event, $dish);
        });

        $this->menuPublisher->published($event);
    }

    /** @param array{name: string, for: 'everyone'|'children', allergens?: list<string>, containsNone?: bool, diets?: list<string>, cost?: ?string, lastPrice?: ?array{amount: string, currency: string}} $sent */
    public function changeVariant(Event $event, MenuDishVariant $variant, array $sent, bool $withCost, User $by, bool $askAgain = false): void
    {
        $this->locked($event, function () use ($event, $variant, $sent, $withCost, $by, $askAgain): void {
            $this->entityManager->refresh($variant);
            $others = Vec\filter($this->menuDishVariantRepository->findOnDish($variant->getDish()), static fn (MenuDishVariant $one): bool => $one !== $variant);
            $details = $this->variantRules->details([$sent], Vec\values($others), $event->getCurrency())[0];
            $before = self::recordedVariant($variant);
            $added = Vec\filter($details->allergens, static fn (string $code): bool => !Iter\contains($variant->getAllergens(), $code));
            $this->menuReasks->ask($variant->getDish()->getCourse(), [$this->menuReasks->withAllergens($this->onVariant($variant), $added)], $askAgain);
            $variant->describe($details->name, $details->forChildren, $details->allergens, $details->diets);

            if ($withCost) {
                $variant->setCostMinor($details->price?->minor);
            }

            $changes = Auditor::diff($before, self::recordedVariant($variant));

            if ([] !== $changes) {
                $this->audit(self::VARIANT_CHANGED, 'MenuDishVariant', $variant->getId(), $by, $changes);
            }

            $this->refuseUnfinishedDefault($event, $variant->getDish());
        });

        $this->menuPublisher->published($event);
    }

    /** Removing one of two folds the other into the dish: a Children only variant then serves every guest. */
    public function removeVariant(Event $event, MenuDishVariant $variant, User $by, bool $askAgain = false): void
    {
        $this->locked($event, function () use ($variant, $by, $askAgain): void {
            $dish = $variant->getDish();
            $left = Vec\filter($this->menuDishVariantRepository->findOnDish($dish), static fn (MenuDishVariant $one): bool => $one !== $variant);

            self::refuseDefault($dish, $variant);
            $folding = 1 === Iter\count($left);

            if (Iter\count($left) >= 2 && !$variant->isForChildren() && Iter\all($left, static fn (MenuDishVariant $one): bool => $one->isForChildren())) {
                throw new ApiException(ErrorCode::VariantLastEveryone, 'menu.variant_last_everyone', parameters: ['{variant}' => $variant->getName()]);
            }

            $this->menuReasks->ask($dish->getCourse(), [['answers' => $this->onVariant($variant), 'why' => MenuChangeWhy::Removed]], $askAgain);
            $this->audit(self::VARIANT_REMOVED, 'MenuDishVariant', $variant->getId(), $by, Auditor::diff(self::recordedVariant($variant), []));
            $this->entityManager->remove($variant);

            if ($folding) {
                $staying = Vec\values($left)[0];

                foreach ($this->onVariant($staying) as $answer) {
                    $answer->foldWay();
                }

                $course = $dish->getCourse();
                $chooseBy = $course->getChooseBy();

                if ($course->getDefaultVariant() === $staying && null !== $chooseBy) {
                    $course->giveByDefault($dish, null, $course->getDefaultOptions(), $chooseBy);
                }

                $before = self::recordedDish($dish);
                $dish->foldFrom($staying);
                $dish->dropItem(null);
                $this->audit(self::DISH_FOLDED, 'MenuDish', $dish->getId(), $by, Auditor::diff($before, [...self::recordedDish($dish), 'from' => $staying->getName()]));
                $this->entityManager->remove($staying);
            }
        });

        $this->menuPublisher->published($event);
    }

    /** @param array{question: string, options: list<array{id?: string, name: string, allergens?: list<string>, containsNone?: bool}>, pick: int, required: bool} $sent refused 409 `choice_limit` at 3 */
    public function addChoice(Event $event, MenuDish $dish, array $sent, User $by, bool $askAgain = false): MenuDishChoice
    {
        $choice = $this->locked($event, function () use ($event, $dish, $sent, $by, $askAgain): MenuDishChoice {
            $this->entityManager->refresh($dish);
            $choices = $this->menuDishChoiceRepository->findOnDish($dish);

            if (Iter\count($choices) >= MenuDishChoice::PER_DISH_MAXIMUM) {
                throw new ApiException(ErrorCode::ChoiceLimit, 'menu.choice_limit', parameters: ['{max}' => MenuDishChoice::PER_DISH_MAXIMUM]);
            }

            $details = $this->choiceRules->details($sent, null, [], false);

            if ($dish->getCourse()->guestsChoose() || [] !== $choices || !self::oneWay($this->menuDishVariantRepository->findOnDish($dish))) {
                $this->menuReasks->ask($dish->getCourse(), [['answers' => $this->menuReasks->naming($dish), 'why' => MenuChangeWhy::Choices]], $askAgain);
            } else {
                $this->menuReasks->askEveryone($event, $dish->getCourse(), $askAgain);
            }

            $next = [] === $choices ? 0 : Math\max(Vec\map($choices, static fn (MenuDishChoice $one): int => $one->getPosition())) + 1;
            $choice = new MenuDishChoice($dish, $details->question, $details->pick, $details->required, $next);
            $this->entityManager->persist($choice);

            foreach ($details->options as $at => $one) {
                $this->entityManager->persist(new MenuChoiceOption($choice, $one->name, $one->allergens, $at));
            }

            $this->audit(self::CHOICE_ADDED, 'MenuDishChoice', $choice->getId(), $by, Auditor::diff([], self::recordedChoice($choice, $details->options)));

            $this->refuseUnfinishedDefault($event, $dish);

            return $choice;
        });

        $this->menuPublisher->published($event);

        return $choice;
    }

    /** @param array{question: string, options: list<array{id?: string, name: string, allergens?: list<string>, containsNone?: bool}>, pick: int, required: bool} $sent */
    public function changeChoice(Event $event, MenuDishChoice $choice, array $sent, User $by, bool $askAgain = false): void
    {
        $this->locked($event, function () use ($event, $choice, $sent, $by, $askAgain): void {
            $this->entityManager->refresh($choice);
            $options = $this->menuChoiceOptionRepository->findOnChoice($choice);
            $answers = $this->answersTo($choice, $options);
            $details = $this->choiceRules->details($sent, $choice, $options, [] !== $answers['picked'] || [] !== $answers['none']);
            $before = self::recordedChoice($choice, $options);
            $byId = Dict\reindex($options, static fn (MenuChoiceOption $one): string => $one->getId()->toRfc4122());
            $kept = Vec\filter_nulls(Vec\map($details->options, static fn (OptionDetails $one): ?string => $one->id));
            $this->menuReasks->ask($choice->getDish()->getCourse(), $this->choiceAsks($choice, $details, $byId, $kept, $answers), $askAgain);

            foreach ($options as $one) {
                if (!Iter\contains($kept, $one->getId()->toRfc4122())) {
                    self::refuseDefault($choice->getDish(), option: $one);
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

                $option->describe($one->name, $one->allergens, $at);
            }

            $changes = Auditor::diff($before, self::recordedChoice($choice, $details->options));

            if ([] !== $changes) {
                $this->audit(self::CHOICE_CHANGED, 'MenuDishChoice', $choice->getId(), $by, $changes);
            }

            $this->refuseUnfinishedDefault($event, $choice->getDish());
        });

        $this->menuPublisher->published($event);
    }

    public function removeChoice(Event $event, MenuDishChoice $choice, User $by, bool $askAgain = false): void
    {
        $this->locked($event, function () use ($choice, $by, $askAgain): void {
            $options = $this->menuChoiceOptionRepository->findOnChoice($choice);

            foreach ($options as $one) {
                self::refuseDefault($choice->getDish(), option: $one);
            }

            $answers = $this->answersTo($choice, $options);
            $this->menuReasks->ask($choice->getDish()->getCourse(), [['answers' => [...Vec\flatten(Vec\values($answers['picked'])), ...$answers['none']], 'why' => MenuChangeWhy::Choices]], $askAgain);

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

        $this->menuPublisher->published($event);
    }

    /**
     * @param list<MenuChoiceOption> $options
     *
     * @return array{picked: array<string, list<MealAnswer>>, none: list<MealAnswer>} by option id
     */
    private function answersTo(MenuDishChoice $choice, array $options): array
    {
        $ids = Vec\map($options, static fn (MenuChoiceOption $one): string => $one->getId()->toRfc4122());
        $naming = $this->menuReasks->naming($choice->getDish());
        $picked = Dict\filter(Dict\from_keys($ids, static fn (string $id): array => Vec\filter($naming, static fn (MealAnswer $answer): bool => Iter\contains($answer->getOptions(), $id))), static fn (array $answers): bool => [] !== $answers);
        $none = $choice->isRequired() ? [] : Vec\filter($naming, static fn (MealAnswer $answer): bool => MealAnswerKind::Chosen === $answer->getKind() && !Iter\any($answer->getOptions(), static fn (string $id): bool => Iter\contains($ids, $id)));

        return ['picked' => $picked, 'none' => $none];
    }

    /**
     * @param array<string, MenuChoiceOption>                                        $byId    the choice's options now
     * @param list<string>                                                           $kept    the ids sent back
     * @param array{picked: array<string, list<MealAnswer>>, none: list<MealAnswer>} $answers
     *
     * @return list<Asked>
     */
    private function choiceAsks(MenuDishChoice $choice, ChoiceDetails $details, array $byId, array $kept, array $answers): array
    {
        $everyone = [...Vec\flatten(Vec\values($answers['picked'])), ...$answers['none']];
        $asked = [];

        if ($details->pick !== $choice->getPick()) {
            $asked[] = ['answers' => $everyone, 'why' => MenuChangeWhy::Choices];
        }

        if ($details->required && !$choice->isRequired()) {
            $asked[] = ['answers' => $answers['none'], 'why' => MenuChangeWhy::Choices];
        }

        foreach ($answers['picked'] as $id => $pickers) {
            if (!Iter\contains($kept, $id)) {
                $asked[] = ['answers' => $pickers, 'why' => MenuChangeWhy::Choices];
            }
        }

        foreach ($details->options as $one) {
            $option = null === $one->id ? null : $byId[$one->id] ?? null;

            if (null !== $option) {
                $asked[] = $this->menuReasks->withAllergens($answers['picked'][$option->getId()->toRfc4122()] ?? [], Vec\filter($one->allergens, static fn (string $code): bool => !Iter\contains($option->getAllergens(), $code)));
            }
        }

        return $asked;
    }

    /** @param iterable<MenuDishVariant|VariantDetails> $ways a set course asks which way only from two ways for everyone */
    private static function oneWay(iterable $ways): bool
    {
        return Iter\count(Vec\filter($ways, static fn (MenuDishVariant|VariantDetails $one): bool => !($one instanceof MenuDishVariant ? $one->isForChildren() : $one->forChildren))) < 2;
    }

    /** @return list<MealAnswer> */
    private function onVariant(MenuDishVariant $variant): array
    {
        return Vec\filter($this->menuReasks->naming($variant->getDish()), static fn (MealAnswer $answer): bool => $answer->getVariant() === $variant);
    }

    /** @param callable(int): MenuDish $made */
    private function addDish(Event $event, MenuCourse $course, User $by, bool $askAgain, callable $made): MenuDish
    {
        $dish = $this->locked($event, function () use ($event, $course, $by, $askAgain, $made): MenuDish {
            $this->entityManager->refresh($course);
            $onCourse = $this->menuDishRepository->findOnCourse($course);

            if ([] === $onCourse && $course->guestsChoose()) {
                $this->menuReasks->askEveryone($event, $course, $askAgain);
            }
            $dish = $made(0 === Iter\count($onCourse) ? 0 : Math\max(Vec\map($onCourse, static fn (MenuDish $one): int => $one->getPosition())) + 1);
            $this->entityManager->persist($dish);
            self::keepAnswerHonest($course, Iter\count($onCourse) + 1);
            $this->audit(self::DISH_ADDED, 'MenuDish', $dish->getId(), $by, Auditor::diff([], self::recordedDish($dish)));

            return $dish;
        });

        $this->menuPublisher->published($event);

        return $dish;
    }

    private static function keepAnswerHonest(MenuCourse $course, int $dishes): void
    {
        if (!$course->guestsChoose() && 1 !== $dishes) {
            $course->setGuestsChoose(true);
        }
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
            $this->menuReasks->refusePast($event);
            $this->entityManager->flush();

            return $changed;
        });
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
            'default' => null === ($dish = $course->getDefaultDish()) ? null : [$dish->getName(), $course->getDefaultVariant()?->getName(), $course->getDefaultOptions()],
            'chooseBy' => $course->getChooseBy()?->format('Y-m-d'),
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
