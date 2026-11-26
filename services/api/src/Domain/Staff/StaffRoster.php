<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Audit\Auditor;
use App\Domain\Staff\Model\StaffDetails;
use App\Domain\Staff\ShiftNotice\ShiftNotices;
use App\Entity\Event;
use App\Entity\StaffJob;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\EventPhase;
use App\Http\Exception\ApiException;
use App\Repository\ShiftAttendanceRepository;
use App\Repository\StaffMemberRepository;
use App\Repository\StaffRateRepository;
use App\Repository\StaffShiftRepository;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The audit holds who and when only: no name or contact detail outlives the erasure. */
final readonly class StaffRoster
{
    public const string ADDED = 'staff.added';

    public const string EDITED = 'staff.edited';

    public const string REMOVED = 'staff.removed';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private StaffMemberRepository $staffMemberRepository,
        private StaffShiftRepository $staffShiftRepository,
        private RosterMemberMatch $rosterMemberMatch,
        private Auditor $auditor,
        private StaffRosterPublisher $staffRosterPublisher,
        private StaffPlan $staffPlan,
        private ShiftNotices $shiftNotices,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
        private ShiftAttendanceRepository $shiftAttendanceRepository,
        private StaffRateRepository $staffRateRepository,
    ) {
    }

    /** Refused 409 `staff_number_shared`, naming the first entry on that number in roster order, unless `allowShared`; a `shift` is refused as Assign refuses it. */
    public function add(Event $event, StaffDetails $details, ?StaffJob $job, ?StaffShift $shift, User $by, bool $allowShared): StaffMember
    {
        $entry = $this->entityManager->wrapInTransaction(function () use ($event, $details, $job, $shift, $by, $allowShared): StaffMember {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);

            if (!$allowShared) {
                $this->refuseShared($event, $details->mobile, null);
            }

            $entry = new StaffMember($event, $details->fullName, $details->mobile, $details->email, $this->rosterMemberMatch->of($event->getOrganisation(), $details));
            $entry->setJob($job);
            $this->entityManager->persist($entry);
            $this->audit(self::ADDED, $entry, $by);

            if (null !== $shift) {
                $this->staffPlan->assignWithin($shift, $entry, $by);
            }
            $this->entityManager->flush();

            return $entry;
        });

        $this->staffRosterPublisher->publish($event);

        return $entry;
    }

    /** Warns as Add does only when the stored number changes; once the contacts are erased only the name and job are kept. Refused 409 `staff_on_shifts` when someone on a shift would change job. */
    public function edit(StaffMember $entry, StaffDetails $details, ?StaffJob $job, User $by, bool $allowShared): StaffMember
    {
        $event = $entry->getEvent();

        $this->entityManager->wrapInTransaction(function () use ($event, $entry, $details, $job, $by, $allowShared): void {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $this->staffPlan->refuseJobChange($entry, $job);
            $erased = null !== $entry->getContactsErasedAt();

            if (!$erased && !$allowShared && $details->mobile !== $entry->getMobile()) {
                $this->refuseShared($event, $details->mobile, $entry);
            }

            $entry->rename($details->fullName);
            $entry->setJob($job);

            if (!$erased) {
                $entry->reach($details->mobile, $details->email, $this->rosterMemberMatch->of($event->getOrganisation(), $details));
            }

            $this->audit(self::EDITED, $entry, $by);
            $this->entityManager->flush();
        });

        $this->staffRosterPublisher->publish($event);

        return $entry;
    }

    /** Refused 409 `event_concluded` once the event has finished, so its hours keep who worked them. Before then the times of a shift they clocked in on outlive them, under their name and at their own rate (Decided, 26 Nov); their contacts go with the entry. */
    public function remove(StaffMember $entry, User $by): void
    {
        $event = $entry->getEvent();

        $this->entityManager->wrapInTransaction(function () use ($event, $entry, $by): void {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);

            if (EventPhase::Finished === EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $this->clock->now())) {
                throw new ApiException(ErrorCode::EventConcluded, $this->translator->trans('staff.finished_keeps'));
            }

            $this->audit(self::REMOVED, $entry, $by);
            $this->shiftNotices->removed($entry);
            $this->staffPlan->release($entry);
            $ownRate = $this->staffRateRepository->findOneBy(['person' => $entry]);

            foreach ($this->shiftAttendanceRepository->findOfPerson($entry) as $attendance) {
                if ($attendance->worked()) {
                    $attendance->outliveRemoval($ownRate);
                } else {
                    $this->entityManager->remove($attendance);
                }
            }

            $this->entityManager->remove($entry);
            $this->entityManager->flush();
        });

        $this->staffRosterPublisher->publish($event);
    }

    private function refuseShared(Event $event, ?string $mobile, ?StaffMember $besides): void
    {
        $shared = null === $mobile ? null : Iter\search(
            RosterOrder::sort($this->staffMemberRepository->findOnEvent($event), $this->earliest($event)),
            static fn (StaffMember $entry): bool => $entry->getMobile() === $mobile && $entry !== $besides,
        );

        if (null !== $shared) {
            throw new ApiException(
                ErrorCode::StaffNumberShared,
                $this->translator->trans('staff.number_shared', ['{name}' => $shared->getFullName()]),
                members: ['sharedWith' => $shared->getFullName()],
            );
        }
    }

    /** @return array<string, list<StaffShift>> */
    private function earliest(Event $event): array
    {
        $theirs = [];

        foreach ($this->staffShiftRepository->findOnEvent($event) as $shift) {
            foreach ($shift->getPeople() as $person) {
                $theirs[$person->getId()->toRfc4122()][] = $shift;
            }
        }

        return $theirs;
    }

    private function audit(string $action, StaffMember $entry, User $by): void
    {
        $this->auditor->record($action, 'StaffMember', $entry->getId(), Actor::User, $by->getId(), $by->getName());
    }
}
