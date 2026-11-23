<?php

declare(strict_types=1);

namespace App\Domain\Menu\Pick;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MealAnswer;
use App\Entity\MenuChoiceOption;
use App\Enum\MealAnswerKind;
use App\Repository\MealAnswerRepository;
use App\Repository\MenuChoiceOptionRepository;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/**
 * @phpstan-import-type GuestDish from GuestMenu
 * @phpstan-import-type Course from PicksMenu
 * @phpstan-import-type Spot from PicksMenu
 */
final readonly class PickSpots
{
    public function __construct(
        private GuestMenu $guestMenu,
        private GuestNeedsRecord $guestNeedsRecord,
        private MealAnswerRepository $mealAnswerRepository,
        private MenuChoiceOptionRepository $menuChoiceOptionRepository,
        private ServedMeals $servedMeals,
    ) {
    }

    /**
     * @param list<Guest>  $room
     * @param list<Course> $courses
     *
     * @return array<string, array<string, Spot>> by course, then person
     */
    public function of(Event $event, array $room, array $courses): array
    {
        $needs = $this->guestNeedsRecord->of($room);
        $allergens = Dict\map($needs, MealAllergens::of(...));
        $answers = Dict\from_entries(Vec\map(
            $this->mealAnswerRepository->findFor($room),
            static fn (MealAnswer $answer): array => [$answer->getCourse()->getId()->toRfc4122() . '/' . $answer->getPerson()->getId()->toRfc4122(), $answer],
        ));
        $options = [] === $answers ? [] : Dict\from_entries(Vec\map(
            $this->menuChoiceOptionRepository->findOnEvent($event),
            static fn (MenuChoiceOption $option): array => [$option->getId()->toRfc4122(), $option],
        ));
        $offered = Dict\from_entries(Vec\map($this->guestMenu->menu($event), static fn (array $course): array => [$course['id'], $course]));
        $spots = [];

        foreach ($courses as $course) {
            $spots[$course['id']] = [];

            foreach ($room as $person) {
                $id = $person->getId()->toRfc4122();
                $answer = $answers[$course['id'] . '/' . $id] ?? null;
                $theirs = $allergens[$id] ?? [];
                $spots[$course['id']][$id] = $this->spotOf($answer, $course, $offered[$course['id']]['dishes'] ?? [], $theirs, $options, $needs[$id] ?? GuestNeeds::none());
            }
        }

        return $spots;
    }

    /**
     * @param Course                          $course
     * @param list<GuestDish>                 $guestDishes the course's dishes as guests are offered them
     * @param list<string>                    $allergens
     * @param array<string, MenuChoiceOption> $options
     *
     * @return Spot `excluded` on a person with no answer the course's default is never given to, with why
     */
    private function spotOf(?MealAnswer $answer, array $course, array $guestDishes, array $allergens, array $options, GuestNeeds $needs): array
    {
        if (null === $answer && PicksMenu::asksNothing($course)) {
            $plate = PicksMenu::setPlate($course, $allergens);

            return null === $plate ? ['state' => 'host', 'reason' => 'nothing'] : ['state' => 'dish', 'dish' => $plate['dish'], 'variant' => $plate['variant'], 'options' => []];
        }

        if (null === $answer) {
            if (Iter\all($guestDishes, static fn (array $dish): bool => GuestMenu::ruledOut($dish, $allergens))) {
                return ['state' => 'host', 'reason' => 'nothing'];
            }

            $default = $course['default'];

            if (null === $default) {
                return ['state' => 'none'];
            }

            $excluded = MealDefault::exclusion($needs, MealDefault::suitableFor($course));

            if (null !== $excluded) {
                return ['state' => 'none', 'excluded' => $excluded];
            }

            return ($course['picksClose']['closed'] ?? false)
                ? ['state' => 'defaulted', 'dish' => $default['dish'], 'variant' => $default['variant'], 'options' => $default['options']]
                : ['state' => 'none'];
        }

        $dish = $answer->getDish()?->getId()->toRfc4122();
        $onPlate = static fn (string $state): array => ['state' => $state, 'dish' => $dish ?? '', 'variant' => $answer->getVariant()?->getId()->toRfc4122(), 'options' => $answer->getOptions()];

        return match ($answer->getKind()) {
            MealAnswerKind::ChefsChoice => ['state' => 'kitchen'],
            MealAnswerKind::Skipped => ['state' => 'skipped'],
            MealAnswerKind::NeedsHost => ['state' => 'host', 'reason' => 'nothing'],
            MealAnswerKind::Defaulted => $onPlate('defaulted'),
            MealAnswerKind::Chosen => [] === ($since = $this->servedMeals->recordedSince($answer, $allergens, $options))
                ? $onPlate('dish')
                : [...$onPlate('host'), 'reason' => 'allergy', 'pick' => self::pickName($answer, $course), 'allergens' => $since, 'notStated' => ServedMeals::notStated($answer)],
        };
    }

    /** @param Course $course */
    private static function pickName(MealAnswer $answer, array $course): string
    {
        $dish = $answer->getDish()?->getId()->toRfc4122();

        return null === $dish ? '' : PicksMenu::plateName($course, $dish, $answer->getVariant()?->getId()->toRfc4122(), $answer->getOptions());
    }
}
