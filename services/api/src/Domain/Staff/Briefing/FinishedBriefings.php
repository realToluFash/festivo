<?php

declare(strict_types=1);

namespace App\Domain\Staff\Briefing;

use App\Domain\Staff\ShiftNotice\ToldShifts;
use App\Entity\Event;
use App\Entity\StaffMember;
use App\Enum\EventPhase;
use App\Enum\StaffBriefStatus;
use App\Repository\StaffMemberRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** Once the event is Finished nothing can be sent, so no change moves a row's briefing state or its Told line (sc-4333). Every write that can change what a briefing shows goes through here. */
final readonly class FinishedBriefings
{
    public function __construct(
        private StaffMemberRepository $staffMemberRepository,
        private BriefingTracker $briefingTracker,
        private BriefingPrinter $briefingPrinter,
        private ToldShifts $toldShifts,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    /**
     * Called inside the change's transaction, with the event locked.
     *
     * @template T
     *
     * @param callable(): T $change
     *
     * @return T
     */
    public function keeping(Event $event, callable $change): mixed
    {
        if (EventPhase::Finished !== EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $this->clock->now())) {
            return $change();
        }

        $before = Vec\map(
            $this->staffMemberRepository->findOnEvent($event),
            fn (StaffMember $entry): array => [$entry, 'changed' === $this->briefingTracker->stateOf($entry), $this->toldAll($entry)],
        );
        $done = $change();
        $this->entityManager->flush();

        foreach ($before as [$entry, $changed, $toldAll]) {
            if (!$this->entityManager->contains($entry)) {
                continue;
            }

            if (StaffBriefStatus::None !== $entry->getBriefStatus() && $changed !== ('changed' === $this->briefingTracker->stateOf($entry))) {
                $entry->setBrief($entry->getBriefStatus(), $changed ? null : $this->briefingPrinter->printOf($entry));
            }

            if ($toldAll && !$this->toldAll($entry)) {
                $this->toldShifts->toldNow($entry);
            }
        }

        $this->entityManager->flush();

        return $done;
    }

    private function toldAll(StaffMember $entry): bool
    {
        return null !== $entry->getTold() && [] === $this->toldShifts->changesOf($entry);
    }
}
