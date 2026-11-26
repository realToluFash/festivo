<?php

declare(strict_types=1);

namespace App\Domain\Staff\Attendance;

use App\Audit\Auditor;
use App\Domain\Staff\WhosHere\WhosHereSignal;
use App\Entity\ShiftAttendance;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ClockPhase;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\ShiftAttendanceRepository;
use App\Repository\StaffShiftRepository;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/** Clocking in and out (sc-234) at the server's time when the request arrives, never a time the device supplies. */
final readonly class Clocking
{
    public const string CLOCKED_IN = 'staff.clocked_in';

    public const string CLOCKED_OUT = 'staff.clocked_out';

    public function __construct(
        private EntityManagerInterface $entityManager,
        private StaffShiftRepository $staffShiftRepository,
        private ShiftAttendanceRepository $shiftAttendanceRepository,
        private Auditor $auditor,
        private TranslatorInterface $translator,
        private ClockInterface $clock,
        private WhosHereSignal $whosHereSignal,
    ) {
    }

    /** @return array{shift: StaffShift, attendance: ?ShiftAttendance}|null the shift still clocked in on first, then one open to clock in to, else the one under way or next, else the last; null with no shift */
    public function cardOf(StaffMember $entry): ?array
    {
        $now = $this->clock->now();
        $shifts = $this->staffShiftRepository->findOfPerson($entry);
        $attendances = $this->shiftAttendanceRepository->findOfPerson($entry);
        $of = static fn (StaffShift $shift): ?ShiftAttendance => Iter\first(Vec\filter($attendances, static fn (ShiftAttendance $one): bool => $one->getShift() === $shift));
        $in = static fn (ClockPhase $phase): ?StaffShift => Iter\first(Vec\filter($shifts, static fn (StaffShift $shift): bool => $phase === ClockWindow::phase($shift, $of($shift), $now)));
        $shown = $in(ClockPhase::On) ?? $in(ClockPhase::Ready) ?? Iter\first(Vec\filter($shifts, static fn (StaffShift $shift): bool => ClockWindow::endOf($shift) > $now)) ?? Iter\last($shifts);

        return null === $shown ? null : ['shift' => $shown, 'attendance' => $of($shown)];
    }

    /** Clocked in and still able to clock out: the moment that ends, past the person's access to the event (sc-3912) as well as inside it. */
    public function openUntil(StaffMember $entry): ?DateTimeImmutable
    {
        $card = $this->cardOf($entry);
        $in = null === $card ? null : $card['attendance']?->countedIn();

        return null === $card || null === $in || ClockPhase::On !== ClockWindow::phase($card['shift'], $card['attendance'], $this->clock->now())
            ? null
            : ClockWindow::outUntil($card['shift'], $in);
    }

    /** @return array{recorded: bool, shift: StaffShift, attendance: ShiftAttendance} */
    public function clockIn(StaffMember $entry, ?User $by): array
    {
        return $this->told($entry, $this->entityManager->wrapInTransaction(function () use ($entry, $by): array {
            $this->entityManager->refresh($entry, LockMode::PESSIMISTIC_WRITE);
            $card = $this->cardOf($entry) ?? throw $this->closed();
            $attendance = $card['attendance'];

            if (null !== $attendance?->countedIn()) {
                return ['recorded' => false, 'shift' => $card['shift'], 'attendance' => $attendance];
            }

            return ['recorded' => true, 'shift' => $card['shift'], 'attendance' => $this->recordIn($card['shift'], $entry, $attendance, $by)];
        }));
    }

    /** A redeemer put on a shift by a join code that names it, if its window is open; false outside it (sc-72). The caller holds the transaction, and publishes Who's here's signal once it has committed. */
    public function clockInOn(StaffShift $shift, StaffMember $entry, User $by): bool
    {
        $attendance = $this->shiftAttendanceRepository->findOneOn($shift, $entry);

        if (ClockPhase::Ready !== ClockWindow::phase($shift, $attendance, $this->clock->now())) {
            return false;
        }

        $this->recordIn($shift, $entry, $attendance, $by);

        return true;
    }

    /** @return array{recorded: bool, shift: StaffShift, attendance: ShiftAttendance} */
    public function clockOut(StaffMember $entry, ?User $by): array
    {
        return $this->told($entry, $this->entityManager->wrapInTransaction(function () use ($entry, $by): array {
            $this->entityManager->refresh($entry, LockMode::PESSIMISTIC_WRITE);
            $card = $this->cardOf($entry);
            $attendance = $card['attendance'] ?? null;

            if (null === $card || null === $attendance?->countedIn()) {
                throw new ApiException(ErrorCode::Conflict, $this->translator->trans('staff.clock_out_not_in'));
            }

            if (null !== $attendance->countedOut()) {
                return ['recorded' => false, 'shift' => $card['shift'], 'attendance' => $attendance];
            }

            if (ClockPhase::On !== ClockWindow::phase($card['shift'], $attendance, $this->clock->now())) {
                throw $this->closed();
            }

            $attendance->clockOut($this->clock->now());
            $this->audit(self::CLOCKED_OUT, $attendance, $by);
            $this->entityManager->flush();

            return ['recorded' => true, 'shift' => $card['shift'], 'attendance' => $attendance];
        }));
    }

    /**
     * @param array{recorded: bool, shift: StaffShift, attendance: ShiftAttendance} $clocked
     *
     * @return array{recorded: bool, shift: StaffShift, attendance: ShiftAttendance}
     */
    private function told(StaffMember $entry, array $clocked): array
    {
        if ($clocked['recorded']) {
            $this->whosHereSignal->publish($entry->getEvent());
        }

        return $clocked;
    }

    private function recordIn(StaffShift $shift, StaffMember $entry, ?ShiftAttendance $attendance, ?User $by): ShiftAttendance
    {
        if (ClockPhase::Ready !== ClockWindow::phase($shift, $attendance, $this->clock->now())) {
            throw $this->closed();
        }

        if (null === $attendance) {
            $attendance = new ShiftAttendance($shift, $entry);
            $this->entityManager->persist($attendance);
        }

        $attendance->clockIn($this->clock->now());
        $this->audit(self::CLOCKED_IN, $attendance, $by);
        $this->entityManager->flush();

        return $attendance;
    }

    private function closed(): ApiException
    {
        return new ApiException(ErrorCode::Conflict, $this->translator->trans('staff.clock_closed'));
    }

    private function audit(string $action, ShiftAttendance $attendance, ?User $by): void
    {
        $this->auditor->record($action, 'StaffMember', $attendance->getPersonId(), null === $by ? Actor::System : Actor::User, $by?->getId(), $by?->getName() ?? $attendance->name());
    }
}
