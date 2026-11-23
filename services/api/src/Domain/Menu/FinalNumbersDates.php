<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Domain\Event\Timeline\Interfaces\MilestoneSourceInterface;
use App\Domain\Event\Timeline\Model\Milestone;
use App\Domain\Event\Timeline\Model\MilestoneAction;
use App\Domain\Menu\Kitchen\FinalNumbers;
use App\Entity\Event;
use App\Enum\MilestoneOwner;
use App\Enum\PermissionArea;
use App\Repository\KitchenCopyRepository;
use App\Repository\KitchenFinalNumbersRepository;
use DateTimeZone;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** "Give final numbers to the kitchen", owner You, at 23:59 on Final numbers due (sc-30812). Gone once any copy is given, once the event starts, and on an Ended event. */
final readonly class FinalNumbersDates implements MilestoneSourceInterface
{
    public const string KEY = 'menu.final_numbers';

    public function __construct(
        private KitchenFinalNumbersRepository $kitchenFinalNumbersRepository,
        private KitchenCopyRepository $kitchenCopyRepository,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    public function milestones(Event $event): array
    {
        $final = $this->kitchenFinalNumbersRepository->findOneForEvent($event);
        $due = $final?->getDueOn();

        if (null === $final || null === $due || null !== $event->getEndedAt() || $this->clock->now() >= $event->getStartsAt() || $this->kitchenCopyRepository->anyForEvent($event)) {
            return [];
        }

        $action = new MilestoneAction($this->translator->trans('timeline.open_kitchen_sheet'), '/app/events/' . $event->getId()->toRfc4122() . '/menu/kitchen');
        $at = FinalNumbers::endOf($due->format('Y-m-d'), new DateTimeZone($event->getTimeZone()));

        return [new Milestone(self::KEY, $at, $this->translator->trans('timeline.give_final_numbers'), null, MilestoneOwner::You, PermissionArea::Menu, $action, revision: $final->getRevision())];
    }
}
