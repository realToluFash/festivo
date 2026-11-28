<?php

declare(strict_types=1);

namespace App\Domain\RunOfShow\Card;

use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Trigger;
use App\Domain\Messaging\NotificationScheduler;
use App\Domain\RunOfShow\EventDay;
use App\Entity\Event;
use App\Entity\SchedulePress;
use App\Enum\Permission;
use App\Repository\SchedulePressRepository;
use Psl\Dict;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** After each press the server takes, the track's card for everybody who has pressed on it (sc-66580). One pending row per track, so a burst of presses sends the night as it stands when the row goes. */
final readonly class RunOfShowCards
{
    public function __construct(
        private SchedulePressRepository $schedulePressRepository,
        private NotificationScheduler $notificationScheduler,
        private ClockInterface $clock,
    ) {
    }

    /** In the press's own transaction, after it is applied. */
    public function pressed(Event $event, SchedulePress $press): void
    {
        $item = $press->getItem();
        $track = RunOfShowCard::track($item);
        $pressers = Vec\values(Dict\unique(Vec\filter_nulls(Vec\map(
            Vec\filter(
                $this->schedulePressRepository->findStandingOnEvent($event),
                static fn (SchedulePress $other): bool => null === $other->getAnswer() && RunOfShowCard::track($other->getItem()) === $track,
            ),
            static fn (SchedulePress $other): ?string => $other->getPressedBy()?->getId()->toRfc4122(),
        ))));

        if ([] === $pressers) {
            return;
        }

        $eventId = $event->getId()->toRfc4122();
        $day = EventDay::of($item->getStartsAt());
        $place = $item->getPlace();

        $this->notificationScheduler->schedule(
            RunOfShowCard::NAME,
            RunOfShowCard::key($eventId, $day, $place),
            'schedule-press:' . $press->getId()->toRfc4122(),
            Trigger::at($this->clock->now()),
            Audience::namedMembersOfEvent($event->getOrganisation()->getId(), $event->getId(), Permission::RunOfShowManage, Vec\map($pressers, Uuid::fromString(...))),
            ['eventId' => $eventId, 'day' => $day, 'place' => $place],
            $event,
        );
    }
}
