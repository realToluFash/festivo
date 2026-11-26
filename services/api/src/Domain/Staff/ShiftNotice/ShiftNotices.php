<?php

declare(strict_types=1);

namespace App\Domain\Staff\ShiftNotice;

use App\Domain\Messaging\Model\Audience;
use App\Domain\Messaging\Model\Trigger;
use App\Domain\Messaging\NotificationScheduler;
use App\Entity\StaffMember;
use App\Enum\EventPhase;
use DateInterval;
use DateTimeImmutable;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/** Called after the change is flushed, inside its transaction, so the notice and the change commit together (sc-4333). */
final readonly class ShiftNotices
{
    public const string WAIT = 'PT15M';

    public function __construct(
        private ToldShifts $toldShifts,
        private NotificationScheduler $notificationScheduler,
        private ClockInterface $clock,
        private ShiftUrgency $shiftUrgency,
    ) {
    }

    /** Before their briefing went, or once the event is Finished, nothing; with nothing differing, one waiting is taken back. */
    public function changed(StaffMember ...$entries): void
    {
        $now = $this->clock->now();

        foreach ($entries as $entry) {
            $event = $entry->getEvent();

            if (null === $entry->getTold() || EventPhase::Finished === EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $now)) {
                continue;
            }

            if ([] === $this->toldShifts->changesOf($entry)) {
                $this->notificationScheduler->cancel(ShiftChangeNotice::key($entry));

                continue;
            }

            $this->notificationScheduler->schedule(
                ShiftChangeNotice::NAME,
                ShiftChangeNotice::key($entry),
                $entry->getId()->toRfc4122(),
                Trigger::at($now->add(new DateInterval(self::WAIT))),
                Audience::staffMember($event->getId(), $entry->getId()),
                ['staffMemberId' => $entry->getId()->toRfc4122()],
                $event,
            );
        }
    }

    /** The briefing tells them everything as it stands, so a change waiting to go has nothing left to say. The caller flushes. */
    public function briefed(StaffMember $entry): void
    {
        $this->toldShifts->toldNow($entry);
        $this->notificationScheduler->cancel(ShiftChangeNotice::key($entry));
    }

    /** Taken off the roster after their briefing went: one last message, and nothing after it. Called before the entry is removed. */
    public function removed(StaffMember $entry): void
    {
        $this->notificationScheduler->cancel(ShiftChangeNotice::key($entry));
        $account = $entry->getAccount();

        if (null === $entry->getTold() || null === $account) {
            return;
        }

        $event = $entry->getEvent();
        $this->notificationScheduler->schedule(
            StaffRemovedNotice::NAME,
            StaffRemovedNotice::NAME . ':' . $entry->getId()->toRfc4122(),
            $entry->getId()->toRfc4122(),
            Trigger::at($this->clock->now()->add(new DateInterval(self::WAIT))),
            Audience::removedStaffMember($event->getId(), $account->getId()),
            ['eventId' => $event->getId()->toRfc4122(), 'startsAt' => Vec\map($this->shiftUrgency->startsOf($entry), static fn (DateTimeImmutable $start): string => $start->format(\DATE_ATOM))],
            $event,
        );
    }
}
