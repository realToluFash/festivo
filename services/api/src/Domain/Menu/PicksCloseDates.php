<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Domain\Event\Timeline\Interfaces\MilestoneSourceInterface;
use App\Domain\Event\Timeline\Model\Milestone;
use App\Domain\Event\Timeline\Model\MilestoneAction;
use App\Domain\Menu\Http\MenuSerialiser;
use App\Domain\Menu\Model\PicksClose;
use App\Entity\Event;
use App\Enum\MilestoneOwner;
use App\Enum\PermissionArea;
use Psl\Iter;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Picks close, on the earliest close of a course that asks guests anything, linked to the event's Menu (sc-3905). None while no course asks. */
final readonly class PicksCloseDates implements MilestoneSourceInterface
{
    public const string KEY = 'menu.picks_close';

    public function __construct(
        private MenuSerialiser $menuSerialiser,
        private TranslatorInterface $translator,
    ) {
    }

    public function milestones(Event $event): array
    {
        $courses = $this->menuSerialiser->menu($event)['courses'];

        if (!Iter\any($courses, static fn (array $course): bool => null !== ($course['picksClose'] ?? null))) {
            return [];
        }

        $action = new MilestoneAction($this->translator->trans('timeline.open_menu'), '/app/events/' . $event->getId()->toRfc4122() . '/menu');

        return [new Milestone(self::KEY, PicksClose::of($event)->at, $this->translator->trans('timeline.picks_close'), null, MilestoneOwner::Automatic, PermissionArea::Menu, $action)];
    }
}
