<?php

declare(strict_types=1);

namespace App\Domain\Staff\Briefing;

use App\Audit\Auditor;
use App\Domain\Staff\Link\StaffLinks;
use App\Domain\Staff\ShiftNotice\ShiftNotices;
use App\Domain\Staff\StaffRosterPublisher;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\EventPhase;
use App\Enum\StaffBriefStatus;
use App\Enum\StaffLinkStatus;
use App\Http\Exception\ApiException;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Handing the briefing out by hand (sc-3917): a copy leaves the briefing where it was, and Mark as sent after it counts as sent, in the Link column too. */
final readonly class Briefings
{
    public const string MARKED_SENT = 'staff.briefing_marked_sent';

    public function __construct(
        private StaffLinks $staffLinks,
        private BriefingPrinter $briefingPrinter,
        private EntityManagerInterface $entityManager,
        private StaffRosterPublisher $staffRosterPublisher,
        private ShiftNotices $shiftNotices,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
    ) {
    }

    /** A new link, as the Link column's copy gives one (a token per delivery, Copied unless it already went), recorded as the briefing's copy. */
    public function copy(StaffMember $entry, User $by): string
    {
        $url = $this->staffLinks->deliver($entry, $by);

        $this->entityManager->wrapInTransaction(function () use ($entry, $by): void {
            $this->entityManager->refresh($entry, LockMode::PESSIMISTIC_WRITE);
            $entry->setBriefCopy($by, $this->clock->now(), false);
            $this->entityManager->flush();
        });

        $this->staffRosterPublisher->publish($entry->getEvent());

        return $url;
    }

    /** Refused 409 `conflict` with no briefing copy to mark, and 409 `event_concluded` once the event is Finished, when no briefing goes (sc-4333). */
    public function markSent(StaffMember $entry, User $by): void
    {
        $this->entityManager->wrapInTransaction(function () use ($entry, $by): void {
            $this->entityManager->refresh($entry, LockMode::PESSIMISTIC_WRITE);
            $event = $entry->getEvent();

            if (EventPhase::Finished === EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $this->clock->now())) {
                throw new ApiException(ErrorCode::EventConcluded, $this->translator->trans('staff.briefing_concluded'));
            }

            if (null === $entry->getBriefCopyAt()) {
                throw new ApiException(ErrorCode::Conflict, $this->translator->trans('staff.briefing_not_copied'));
            }

            if ($entry->isBriefCopyMarked()) {
                return;
            }

            $now = $this->clock->now();
            $print = $this->briefingPrinter->printOf($entry);
            $read = StaffBriefStatus::Read === $entry->getBriefStatus() && $print === $entry->getBriefPrint();
            $entry->setBrief($read ? StaffBriefStatus::Read : StaffBriefStatus::Sent, $print);
            $entry->setBriefCopy($by, $now, true);
            $this->shiftNotices->briefed($entry);

            if (!$entry->getLinkStatus()->delivered()) {
                $entry->linkMoved(StaffLinkStatus::Sent, $by, $now);
            }

            $this->auditor->record(self::MARKED_SENT, 'StaffMember', $entry->getId(), Actor::User, $by->getId(), $by->getName());
            $this->entityManager->flush();
        });

        $this->staffRosterPublisher->publish($entry->getEvent());
    }
}
