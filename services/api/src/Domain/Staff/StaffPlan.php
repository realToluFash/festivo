<?php

declare(strict_types=1);

namespace App\Domain\Staff;

use App\Audit\Auditor;
use App\Domain\Staff\Model\ShiftDetails;
use App\Entity\Event;
use App\Entity\StaffJob;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\StaffAccess;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Repository\ShiftAttendanceRepository;
use App\Repository\StaffJobRepository;
use App\Repository\StaffMemberRepository;
use App\Repository\StaffShiftRepository;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

/** An event's jobs and shifts, and who fills them (sc-3908). A person has one job on the event, and every shift of theirs is of it. */
final readonly class StaffPlan
{
    public const string JOB_ADDED = 'staff.job_added';

    public const string JOB_EDITED = 'staff.job_edited';

    public const string JOB_REMOVED = 'staff.job_removed';

    public const string SHIFT_ADDED = 'staff.shift_added';

    public const string SHIFT_EDITED = 'staff.shift_edited';

    public const string ASSIGNED = 'staff.assigned';

    public const string UNASSIGNED = 'staff.unassigned';

    private const array SUGGESTED = [
        'floor_lead' => StaffAccess::Run,
        'waiter' => StaffAccess::Floor,
        'runner' => StaffAccess::Floor,
        'bar' => StaffAccess::View,
        'door' => StaffAccess::CheckIn,
        'kitchen' => StaffAccess::Pass,
        'security' => StaffAccess::View,
        'sound' => StaffAccess::View,
        'mc' => StaffAccess::View,
    ];

    public function __construct(
        private EntityManagerInterface $entityManager,
        private StaffJobRepository $staffJobRepository,
        private StaffShiftRepository $staffShiftRepository,
        private StaffMemberRepository $staffMemberRepository,
        private StaffPlanRules $staffPlanRules,
        private ShiftClock $shiftClock,
        private Auditor $auditor,
        private StaffRosterPublisher $staffRosterPublisher,
        private TranslatorInterface $translator,
        private ShiftAttendanceRepository $shiftAttendanceRepository,
    ) {
    }

    public function suggest(Event $event): void
    {
        $position = 0;

        foreach (self::SUGGESTED as $key => $access) {
            $name = $this->translator->trans('staff.job_suggested.' . $key);
            $this->entityManager->persist(new StaffJob($event, $name, NameNormaliser::key($name), $access, $position++));
        }
    }

    public function addJob(Event $event, string $name, StaffAccess $access, User $by): StaffJob
    {
        return $this->changed($event, function () use ($event, $name, $access, $by): StaffJob {
            $kept = $this->staffPlanRules->jobName($event, $name, null);
            $last = Iter\last($this->staffJobRepository->findOnEvent($event));
            $job = new StaffJob($event, $kept, NameNormaliser::key($kept), $access, null === $last ? 0 : $last->getPosition() + 1);
            $this->entityManager->persist($job);
            $this->audit(self::JOB_ADDED, 'StaffJob', $job, $by, ['name' => [null, $kept], 'access' => [null, $access->value]]);

            return $job;
        });
    }

    public function editJob(StaffJob $job, string $name, StaffAccess $access, User $by): StaffJob
    {
        $event = $job->getEvent();

        return $this->changed($event, function () use ($event, $job, $name, $access, $by): StaffJob {
            $kept = $this->staffPlanRules->jobName($event, $name, $job);
            $changes = ['name' => [$job->getName(), $kept], 'access' => [$job->getAccess()->value, $access->value]];
            $job->setName($kept, NameNormaliser::key($kept));
            $job->setAccess($access);
            $this->audit(self::JOB_EDITED, 'StaffJob', $job, $by, $changes);

            return $job;
        });
    }

    public function removeJob(StaffJob $job, User $by): void
    {
        $event = $job->getEvent();

        $this->changed($event, function () use ($job, $by): null {
            $shifts = $this->staffShiftRepository->findOfJob($job);

            if ($this->shiftAttendanceRepository->anyWorkedInJob($job)) {
                throw new ApiException(ErrorCode::StaffJobWorked, $this->translator->trans('staff.job_worked'));
            }

            if (Iter\any($shifts, static fn (StaffShift $shift): bool => [] !== $shift->getPeople())) {
                throw new ApiException(ErrorCode::StaffJobStaffed, 'staff.job_staffed');
            }

            foreach ($this->staffMemberRepository->findBy(['job' => $job]) as $person) {
                $person->setJob(null);
            }

            foreach ($shifts as $shift) {
                $this->entityManager->remove($shift);
            }

            $this->audit(self::JOB_REMOVED, 'StaffJob', $job, $by, ['name' => [$job->getName(), null]]);
            $this->entityManager->remove($job);

            return null;
        });
    }

    public function addShift(StaffJob $job, ShiftDetails $details, User $by): StaffShift
    {
        return $this->changed($job->getEvent(), function () use ($job, $details, $by): StaffShift {
            $shift = new StaffShift($job, $details->startsAt, $details->endsAt, $details->needed);
            $this->entityManager->persist($shift);
            $this->audit(self::SHIFT_ADDED, 'StaffShift', $shift, $by, Auditor::diff([], self::recorded($shift)));

            return $shift;
        });
    }

    public function editShift(StaffShift $shift, string $startsAt, string $endsAt, int $needed, User $by): StaffShift
    {
        $event = $shift->getJob()->getEvent();

        return $this->changed($event, function () use ($event, $shift, $startsAt, $endsAt, $needed, $by): StaffShift {
            $this->entityManager->refresh($shift);
            $details = $this->staffPlanRules->shift($event, true, $startsAt, $endsAt, $needed, Iter\count($shift->getPeople()));

            foreach ($shift->getPeople() as $person) {
                $this->refuseOverlap($event, $person, $shift, $details->startsAt, $details->endsAt);
            }

            $before = self::recorded($shift);
            $shift->setStartsAt($details->startsAt);
            $shift->setEndsAt($details->endsAt);
            $shift->setNeeded($details->needed);
            $this->audit(self::SHIFT_EDITED, 'StaffShift', $shift, $by, Auditor::diff($before, self::recorded($shift)));

            return $shift;
        });
    }

    public function assign(StaffShift $shift, StaffMember $person, User $by): StaffShift
    {
        $event = $shift->getJob()->getEvent();

        return $this->changed($event, function () use ($event, $shift, $person, $by): StaffShift {
            $this->entityManager->refresh($shift);
            $this->refuseAssign($event, $shift, $person);
            $this->place($shift, $person);
            $this->audit(self::ASSIGNED, 'StaffShift', $shift, $by, ['person' => [null, $person->getId()->toRfc4122()]]);

            return $shift;
        });
    }

    public function assignWithin(StaffShift $shift, StaffMember $person, User $by): void
    {
        $this->entityManager->refresh($shift);
        $this->refuseAssign($shift->getJob()->getEvent(), $shift, $person);
        $this->place($shift, $person);
        $this->audit(self::ASSIGNED, 'StaffShift', $shift, $by, ['person' => [null, $person->getId()->toRfc4122()]]);
    }

    /** Refused 409 `staff_shift_worked` once they have a clock-in on it (Decided, 26 Nov). */
    public function unassign(StaffShift $shift, StaffMember $person, User $by): StaffShift
    {
        return $this->changed($shift->getJob()->getEvent(), function () use ($shift, $person, $by): StaffShift {
            $this->entityManager->refresh($shift);

            if (true === $this->shiftAttendanceRepository->findOneOn($shift, $person)?->worked()) {
                throw new ApiException(ErrorCode::StaffShiftWorked, $this->translator->trans('staff.shift_worked', ['{name}' => $person->getFullName()]));
            }
            $shift->setPeople(Vec\filter($shift->getPeople(), static fn (StaffMember $one): bool => $one !== $person));
            $this->audit(self::UNASSIGNED, 'StaffShift', $shift, $by, ['person' => [$person->getId()->toRfc4122(), null]]);

            return $shift;
        });
    }

    public function release(StaffMember $person): void
    {
        foreach ($this->staffShiftRepository->findOfPerson($person) as $shift) {
            $shift->setPeople(Vec\filter($shift->getPeople(), static fn (StaffMember $one): bool => $one !== $person));
        }
    }

    public function refuseJobChange(StaffMember $person, ?StaffJob $job): void
    {
        if ($job === $person->getJob() || [] === $this->staffShiftRepository->findOfPerson($person)) {
            return;
        }

        throw new ApiException(
            ErrorCode::StaffOnShifts,
            'staff.on_shifts',
            parameters: ['{name}' => $person->getFullName()],
        );
    }

    /** Full, then another job, then an overlap: the order the form refuses in. */
    private function refuseAssign(Event $event, StaffShift $shift, StaffMember $person): void
    {
        if (Iter\contains($shift->getPeople(), $person)) {
            return;
        }

        if (Iter\count($shift->getPeople()) >= $shift->getNeeded()) {
            throw new ApiException(ErrorCode::StaffShiftFull, 'staff.shift_full');
        }

        $job = $person->getJob();

        if (null !== $job && $job !== $shift->getJob()) {
            throw new ApiException(
                ErrorCode::StaffWorksAs,
                'staff.works_as',
                members: ['job' => $job->getName()],
                parameters: ['{name}' => $person->getFullName(), '{job}' => $job->getName()],
            );
        }

        $this->refuseOverlap($event, $person, $shift, $shift->getStartsAt(), $shift->getEndsAt());
    }

    private function place(StaffShift $shift, StaffMember $person): void
    {
        if (Iter\contains($shift->getPeople(), $person)) {
            return;
        }

        $shift->setPeople([...$shift->getPeople(), $person]);

        if (null === $person->getJob()) {
            $person->setJob($shift->getJob());
        }
    }

    private function refuseOverlap(Event $event, StaffMember $person, StaffShift $besides, DateTimeImmutable $startsAt, DateTimeImmutable $endsAt): void
    {
        $other = Iter\search(
            $this->staffShiftRepository->findOfPerson($person),
            static fn (StaffShift $shift): bool => $shift !== $besides && ShiftClock::overlaps($shift, $startsAt, $endsAt),
        );

        if (null === $other) {
            return;
        }

        $long = ShiftClock::isLong($event, $this->staffShiftRepository->findOnEvent($event));

        throw new ApiException(
            ErrorCode::StaffShiftOverlap,
            'staff.shift_overlap',
            members: [
                'shift' => [
                    'id' => $other->getId()->toRfc4122(),
                    'job' => $other->getJob()->getName(),
                    'startsAt' => ShiftClock::instant($other->getStartsAt(), $event)->format(\DATE_ATOM),
                    'endsAt' => ShiftClock::instant($other->getEndsAt(), $event)->format(\DATE_ATOM),
                ],
            ],
            parameters: [
                '{name}' => $person->getFullName(),
                '{job}' => $other->getJob()->getName(),
                '{when}' => $this->shiftClock->range($other->getStartsAt(), $other->getEndsAt(), $long),
            ],
        );
    }

    /**
     * @template T
     *
     * @param callable(): T $change
     *
     * @return T
     */
    private function changed(Event $event, callable $change): mixed
    {
        $done = $this->entityManager->wrapInTransaction(function () use ($event, $change): mixed {
            $this->entityManager->refresh($event, LockMode::PESSIMISTIC_WRITE);
            $done = $change();
            $this->entityManager->flush();

            return $done;
        });

        $this->staffRosterPublisher->publish($event);

        return $done;
    }

    /** @return array<string, int|string> */
    private static function recorded(StaffShift $shift): array
    {
        return [
            'startsAt' => $shift->getStartsAt()->format('Y-m-d\TH:i'),
            'endsAt' => $shift->getEndsAt()->format('Y-m-d\TH:i'),
            'needed' => $shift->getNeeded(),
        ];
    }

    /** @param array<string, array{0: mixed, 1: mixed}> $changes */
    private function audit(string $action, string $type, StaffJob|StaffShift $subject, User $by, array $changes): void
    {
        $this->auditor->record($action, $type, $subject->getId(), Actor::User, $by->getId(), $by->getName(), $changes);
    }
}
