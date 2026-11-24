<?php

declare(strict_types=1);

namespace App\Domain\Menu\Pick;

use App\Domain\Guest\GuestNeedsRecord;
use App\Domain\Guest\Model\GuestNeeds;
use App\Entity\Event;
use App\Entity\Guest;
use Psl\Iter;
use Psl\Vec;

/** What changing a course's default does to the people given it (sc-1362): those whose diets the new one meets move to it, the rest go back to not chosen. Worked out from who is given it now, and never stored. */
final readonly class DefaultMoves
{
    public function __construct(
        private PicksFigures $picksFigures,
        private PicksMenu $picksMenu,
        private PickSpots $pickSpots,
        private GuestNeedsRecord $guestNeedsRecord,
    ) {
    }

    /**
     * @param list<string> $suitable the new default's diets
     *
     * @return array{move: int, back: int}
     */
    public function of(Event $event, string $courseId, array $suitable): array
    {
        $course = Iter\search($this->picksMenu->courses($event), static fn (array $one): bool => $one['id'] === $courseId);

        if (null === $course || null === $course['default']) {
            return ['move' => 0, 'back' => 0];
        }

        $room = $this->picksFigures->room($event);
        $spots = $this->pickSpots->of($event, $room, [$course])[$courseId];
        $given = Vec\filter($room, static fn (Guest $person): bool => 'defaulted' === $spots[$person->getId()->toRfc4122()]['state']);
        $needs = $this->guestNeedsRecord->of($given);
        $move = Iter\count(Vec\filter($given, static fn (Guest $person): bool => null === MealDefault::exclusion($needs[$person->getId()->toRfc4122()] ?? GuestNeeds::none(), $suitable)));

        return ['move' => $move, 'back' => Iter\count($given) - $move];
    }
}
