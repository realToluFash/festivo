<?php

declare(strict_types=1);

namespace App\Domain\Menu;

use App\Domain\Event\Timeline\Interfaces\MilestoneSourceInterface;
use App\Domain\Event\Timeline\Model\Milestone;
use App\Domain\Event\Timeline\Model\MilestoneAction;
use App\Domain\Menu\Kitchen\FinalNumbers;
use App\Domain\Menu\Kitchen\KitchenUnsent;
use App\Entity\Event;
use App\Enum\MilestoneOwner;
use App\Enum\PermissionArea;
use App\Repository\KitchenCopyRepository;
use App\Repository\KitchenFinalNumbersRepository;
use DateTimeImmutable;
use DateTimeZone;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The two You milestones: Give final numbers until a first copy (sc-30812), then Give the changes while the sheet differs from the latest (sc-30692). */
final readonly class FinalNumbersDates implements MilestoneSourceInterface
{
    public const string KEY = 'menu.final_numbers';

    public const string CHANGES_KEY = 'menu.kitchen_changes';

    public function __construct(
        private KitchenFinalNumbersRepository $kitchenFinalNumbersRepository,
        private KitchenCopyRepository $kitchenCopyRepository,
        private KitchenUnsent $kitchenUnsent,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    public function milestones(Event $event): array
    {
        if (null !== $event->getEndedAt() || $this->clock->now() >= $event->getStartsAt()) {
            return [];
        }

        $zone = new DateTimeZone($event->getTimeZone());

        if ($this->kitchenCopyRepository->anyForEvent($event)) {
            $unsent = $this->kitchenUnsent->check($event, true);
            $since = $unsent?->getDiffersSince();

            if (null === $unsent || null === $since) {
                return [];
            }

            $day = $unsent->getDueOn();
            $end = null === $day ? null : FinalNumbers::endOf($day->format('Y-m-d'), $zone);
            $at = null !== $end && $since <= $end ? $end : $event->getStartsAt();

            return [$this->milestone($event, self::CHANGES_KEY, $at, 'timeline.give_kitchen_changes', $unsent->getRevision())];
        }

        $final = $this->kitchenFinalNumbersRepository->findOneForEvent($event);
        $due = $final?->getDueOn();

        return null === $final || null === $due ? [] : [$this->milestone($event, self::KEY, FinalNumbers::endOf($due->format('Y-m-d'), $zone), 'timeline.give_final_numbers', $final->getRevision())];
    }

    private function milestone(Event $event, string $key, DateTimeImmutable $at, string $title, int $revision): Milestone
    {
        $action = new MilestoneAction($this->translator->trans('timeline.open_kitchen_sheet'), '/app/events/' . $event->getId()->toRfc4122() . '/menu/kitchen');

        return new Milestone($key, $at, $this->translator->trans($title), null, MilestoneOwner::You, PermissionArea::Menu, $action, revision: $revision);
    }
}
