<?php

declare(strict_types=1);

namespace App\Domain\Menu\Pick;

use App\Domain\Guest\Headcount\HeadcountCalculator;
use App\Domain\Messaging\Interfaces\MealsNotChosenInterface;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\MealAnswer;
use App\Enum\GuestStanding;
use App\Repository\GuestRepository;
use App\Repository\MealAnswerRepository;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/** The people coming with a course that asks still unanswered (sc-80901): any answer, chef's choice and skipped included, settles a course. */
final readonly class MealsNotChosen implements MealsNotChosenInterface
{
    public function __construct(
        private GuestMenu $guestMenu,
        private GuestRepository $guestRepository,
        private MealAnswerRepository $mealAnswerRepository,
    ) {
    }

    public function people(Event $event): array
    {
        $asked = Vec\map($this->guestMenu->menu($event), static fn (array $course): string => $course['id']);

        if ([] === $asked) {
            return [];
        }

        $coming = Vec\filter(
            $this->guestRepository->findOnList($event),
            static fn (Guest $person): bool => !($person->getHost()?->isRemoved() ?? false) && GuestStanding::Accepted === HeadcountCalculator::standing($person),
        );
        $answered = Dict\map(
            Dict\group_by($this->mealAnswerRepository->findFor($coming), static fn (MealAnswer $answer): string => $answer->getPerson()->getId()->toRfc4122()),
            static fn (array $answers): array => Vec\map($answers, static fn (MealAnswer $answer): string => $answer->getCourse()->getId()->toRfc4122()),
        );

        return Vec\filter($coming, static fn (Guest $person): bool => Iter\any(
            $asked,
            static fn (string $course): bool => !Iter\contains($answered[$person->getId()->toRfc4122()] ?? [], $course),
        ));
    }
}
