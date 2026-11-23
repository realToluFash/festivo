<?php

declare(strict_types=1);

namespace App\Domain\Menu\Pick;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Headcount\HeadcountCalculator;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Menu\DishRules;
use App\Entity\Guest;
use App\Entity\MealAnswer;
use App\Entity\MenuChoiceOption;
use App\Enum\MealAnswerKind;
use App\Enum\MenuChangeWhy;
use App\Repository\MealAnswerRepository;
use App\Repository\MenuChoiceOptionRepository;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/** Stored meal answers as they are served (sc-3907): a chosen pick holding an allergen recorded since it was made is needs the host, and still names the pick. A course's default is served, once its date has passed, to each person coming with no answer whom it can't harm (sc-1362). */
final readonly class ServedMeals
{
    public function __construct(
        private MealAnswerRepository $mealAnswerRepository,
        private MenuChoiceOptionRepository $menuChoiceOptionRepository,
        private GuestNeedsRecord $guestNeedsRecord,
        private GuestMenu $guestMenu,
    ) {
    }

    /**
     * @param non-empty-list<Guest> $people one party, the guest first
     *
     * @return array{answers: array<string, list<array{course: string, answer: string, dish: ?string, variant: ?string, options: list<string>, changed: ?array{picked: string, why: string, ways: ?int, allergens: list<string>}}>>, excluded: array<string, list<array{course: string, reason: string}>>} each by the person's id; `changed` on an answer a menu change asked again (sc-3913); `excluded` names the courses whose default the person is never given, and why
     */
    public function of(array $people): array
    {
        $needs = $this->guestNeedsRecord->of($people);
        $byPerson = Dict\group_by($this->mealAnswerRepository->findFor($people), static fn (MealAnswer $answer): string => $answer->getPerson()->getId()->toRfc4122());
        $options = [] === $byPerson ? [] : Dict\from_entries(Vec\map(
            $this->menuChoiceOptionRepository->findOnEvent($people[0]->getEvent()),
            static fn (MenuChoiceOption $option): array => [$option->getId()->toRfc4122(), $option],
        ));
        $withDefault = Vec\filter($this->guestMenu->menu($people[0]->getEvent()), static fn (array $course): bool => null !== $course['default']);
        $answers = [];
        $excluded = [];

        foreach ($people as $person) {
            $id = $person->getId()->toRfc4122();
            $theirs = $byPerson[$id] ?? [];
            $allergens = isset($needs[$id]) ? MealAllergens::of($needs[$id]) : [];
            $answered = Vec\map($theirs, static fn (MealAnswer $answer): string => $answer->getCourse()->getId()->toRfc4122());
            $served = Vec\map($theirs, fn (MealAnswer $answer): array => [
                'course' => $answer->getCourse()->getId()->toRfc4122(),
                'answer' => $this->served($answer, $allergens, $options)->value,
                'dish' => $answer->getDish()?->getId()->toRfc4122(),
                'variant' => $answer->getVariant()?->getId()->toRfc4122(),
                'options' => $answer->getOptions(),
                'changed' => MealAnswerKind::MenuChanged === $answer->getKind()
                    ? ['picked' => $answer->getChangedFrom() ?? '', 'why' => ($answer->getChangedWhy() ?? MenuChangeWhy::Removed)->value, 'ways' => $answer->getChangedWays(), 'allergens' => Vec\filter(DishRules::allergenCodes(), static fn (string $code): bool => Iter\contains($answer->getChangedAllergens(), $code))]
                    : null,
            ]);

            foreach ($withDefault as $course) {
                $default = $course['default'];

                if (null === $default || Iter\contains($answered, $course['id']) || !HeadcountCalculator::isComing($person) || Iter\all($course['dishes'], static fn (array $dish): bool => GuestMenu::ruledOut($dish, $allergens))) {
                    continue;
                }

                $reason = MealDefault::exclusion($needs[$id] ?? GuestNeeds::none(), MealDefault::suitableFor($course));

                if (null !== $reason) {
                    $excluded[$id][] = ['course' => $course['id'], 'reason' => $reason];
                } elseif ($course['picksClose']['closed']) {
                    $served[] = ['course' => $course['id'], 'answer' => MealAnswerKind::Defaulted->value, 'dish' => $default['dish'], 'variant' => $default['variant'], 'options' => $default['options'], 'changed' => null];
                }
            }

            if ([] !== $served) {
                $answers[$id] = $served;
            }
        }

        return ['answers' => $answers, 'excluded' => $excluded];
    }

    /**
     * @param list<string>                    $allergens the person's now
     * @param array<string, MenuChoiceOption> $options   the event's, by id
     */
    public function served(MealAnswer $answer, array $allergens, array $options): MealAnswerKind
    {
        if (MealAnswerKind::Chosen !== $answer->getKind() || null === $answer->getDish()) {
            return $answer->getKind();
        }

        return [] === $this->recordedSince($answer, $allergens, $options) ? MealAnswerKind::Chosen : MealAnswerKind::NeedsHost;
    }

    /**
     * @param list<string>                    $allergens the person's now
     * @param array<string, MenuChoiceOption> $options   the event's, by id
     *
     * @return list<string> the allergens on the chosen plate recorded since it was picked (sc-3909 names them)
     */
    public function recordedSince(MealAnswer $answer, array $allergens, array $options): array
    {
        $dish = $answer->getDish();
        $variant = $answer->getVariant();

        if (null === $dish) {
            return [];
        }

        $plate = MealAllergens::onPlate(
            null === $variant ? $dish->getAllergens() : $variant->getAllergens(),
            Vec\map(Vec\filter_nulls(Vec\map($answer->getOptions(), static fn (string $id): ?MenuChoiceOption => $options[$id] ?? null)), static fn (MenuChoiceOption $option): array => $option->getAllergens()),
        );
        $since = Vec\filter($allergens, static fn (string $code): bool => !Iter\contains($answer->getAllergensAtPick(), $code));

        return MealAllergens::against($plate, $since);
    }
}
