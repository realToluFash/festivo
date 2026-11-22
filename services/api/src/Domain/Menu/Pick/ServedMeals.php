<?php

declare(strict_types=1);

namespace App\Domain\Menu\Pick;

use App\Domain\Guest\GuestNeedsRecord;
use App\Entity\Guest;
use App\Entity\MealAnswer;
use App\Entity\MenuChoiceOption;
use App\Enum\MealAnswerKind;
use App\Repository\MealAnswerRepository;
use App\Repository\MenuChoiceOptionRepository;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/** Stored meal answers as they are served (sc-3907): a chosen pick holding an allergen recorded since it was made is needs the host, and still names the pick. */
final readonly class ServedMeals
{
    public function __construct(
        private MealAnswerRepository $mealAnswerRepository,
        private MenuChoiceOptionRepository $menuChoiceOptionRepository,
        private GuestNeedsRecord $guestNeedsRecord,
    ) {
    }

    /**
     * @param list<Guest> $people
     *
     * @return array<string, list<array{course: string, answer: string, dish: ?string, variant: ?string, options: list<string>}>> by the person's id
     */
    public function answersOf(array $people): array
    {
        $needs = $this->guestNeedsRecord->of($people);
        $byPerson = Dict\group_by($this->mealAnswerRepository->findFor($people), static fn (MealAnswer $answer): string => $answer->getPerson()->getId()->toRfc4122());
        $options = [] === $byPerson ? [] : Dict\from_entries(Vec\map(
            $this->menuChoiceOptionRepository->findOnEvent($people[0]->getEvent()),
            static fn (MenuChoiceOption $option): array => [$option->getId()->toRfc4122(), $option],
        ));

        return Dict\map_with_key($byPerson, function (string $id, array $answers) use ($needs, $options): array {
            $allergens = isset($needs[$id]) ? MealAllergens::of($needs[$id]) : [];

            return Vec\map($answers, fn (MealAnswer $answer): array => [
                'course' => $answer->getCourse()->getId()->toRfc4122(),
                'answer' => $this->served($answer, $allergens, $options)->value,
                'dish' => $answer->getDish()?->getId()->toRfc4122(),
                'variant' => $answer->getVariant()?->getId()->toRfc4122(),
                'options' => $answer->getOptions(),
            ]);
        });
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
