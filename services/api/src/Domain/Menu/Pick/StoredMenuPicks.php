<?php

declare(strict_types=1);

namespace App\Domain\Menu\Pick;

use App\Domain\Guest\Headcount\HeadcountCalculator;
use App\Domain\Menu\Interfaces\MenuPicksInterface;
use App\Entity\Guest;
use App\Entity\MealAnswer;
use App\Entity\MenuChoiceOption;
use App\Entity\MenuDish;
use App\Entity\MenuDishChoice;
use App\Entity\MenuDishVariant;
use App\Enum\MealAnswerKind;
use App\Repository\MealAnswerRepository;
use App\Repository\MenuChoiceOptionRepository;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/** Who has picked from an event's menu, from the answers guests stored (sc-3907). */
final readonly class StoredMenuPicks implements MenuPicksInterface
{
    public function __construct(
        private MealAnswerRepository $mealAnswerRepository,
        private MenuChoiceOptionRepository $menuChoiceOptionRepository,
    ) {
    }

    public function pickersOf(MenuDish $dish): array
    {
        return self::people($this->naming($dish));
    }

    public function pickersOfVariant(MenuDishVariant $variant): array
    {
        return self::people(Vec\filter(
            $this->naming($variant->getDish()),
            static fn (MealAnswer $answer): bool => $answer->getVariant()?->getId()->equals($variant->getId()) ?? false,
        ));
    }

    public function pickersOfOption(MenuChoiceOption $option): array
    {
        $id = $option->getId()->toRfc4122();

        return self::people(Vec\filter(
            $this->naming($option->getChoice()->getDish()),
            static fn (MealAnswer $answer): bool => Iter\contains($answer->getOptions(), $id),
        ));
    }

    public function noneAnswersTo(MenuDishChoice $choice): int
    {
        if ($choice->isRequired()) {
            return 0;
        }

        $ids = Vec\map($this->menuChoiceOptionRepository->findOnChoice($choice), static fn (MenuChoiceOption $option): string => $option->getId()->toRfc4122());

        return Iter\count(Vec\filter(
            $this->naming($choice->getDish()),
            static fn (MealAnswer $answer): bool => MealAnswerKind::Defaulted !== $answer->getKind()
                && !Iter\any($answer->getOptions(), static fn (string $picked): bool => Iter\contains($ids, $picked)),
        ));
    }

    /** @return list<MealAnswer> the answers naming the dish from people the kitchen will cook for: not removed, and coming */
    private function naming(MenuDish $dish): array
    {
        return Vec\filter(
            $this->mealAnswerRepository->findNaming($dish),
            static fn (MealAnswer $answer): bool => HeadcountCalculator::isComing($answer->getPerson()),
        );
    }

    /**
     * @param list<MealAnswer> $answers
     *
     * @return list<Guest>
     */
    private static function people(array $answers): array
    {
        return Vec\values(Dict\from_entries(Vec\map($answers, static fn (MealAnswer $answer): array => [$answer->getPerson()->getId()->toRfc4122(), $answer->getPerson()])));
    }
}
