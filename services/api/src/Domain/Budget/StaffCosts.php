<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\JobCost;
use App\Domain\Budget\Model\JobWorked;
use App\Domain\Budget\Model\OwnCost;
use App\Domain\Budget\Model\OwnWorked;
use App\Domain\Budget\Model\PayRate;
use App\Domain\Budget\Model\ScheduledShift;
use App\Domain\Budget\Model\StaffCost;
use App\Domain\Budget\Model\WorkedCost;
use App\Domain\Staff\Attendance\ClockWindow;
use App\Domain\Staff\Attendance\HoursWorked;
use App\Domain\Staff\Model\WorkedShift;
use App\Domain\Staff\ShiftClock;
use App\Entity\Event;
use App\Entity\ShiftAttendance;
use App\Entity\StaffRate;
use App\Entity\StaffShift;
use App\Enum\HoursMark;
use App\Enum\StaffPay;
use App\Repository\ShiftAttendanceRepository;
use App\Repository\StaffJobRepository;
use App\Repository\StaffRateRepository;
use App\Repository\StaffShiftRepository;
use BcMath\Number;
use DateTimeImmutable;
use Psl\Dict;
use Psl\Iter;
use Psl\Math;
use Psl\Vec;

/** The one place an event's scheduled hours and staff cost are worked out (sc-101), and its hours worked beside them (sc-234): a shift counts once for every place it needs, taken or not, and is worked only by who clocked it. */
final readonly class StaffCosts
{
    public function __construct(
        private StaffJobRepository $staffJobRepository,
        private StaffShiftRepository $staffShiftRepository,
        private StaffRateRepository $staffRateRepository,
        private ShiftAttendanceRepository $shiftAttendanceRepository,
    ) {
    }

    public function of(Event $event): StaffCost
    {
        ['jobs' => $jobRates, 'own' => $ownRates, 'jobOf' => $jobOf] = $this->rates($event);

        return self::priced(
            Vec\map($this->staffJobRepository->findOnEvent($event), static fn ($job): string => $job->getId()->toRfc4122()),
            Vec\map($this->staffShiftRepository->findOnEvent($event), static fn (StaffShift $shift): ScheduledShift => self::scheduled($shift, $event)),
            $jobRates,
            $ownRates,
            $jobOf,
        );
    }

    /** Every assigned place, one row per person per shift; a place nobody took has none. */
    public function workedOf(Event $event, DateTimeImmutable $now): WorkedCost
    {
        ['jobs' => $jobRates, 'own' => $ownRates] = $this->rates($event);

        return self::pricedWorked(
            Vec\map($this->staffJobRepository->findOnEvent($event), static fn ($job): string => $job->getId()->toRfc4122()),
            $this->worked($event, $now),
            $jobRates,
            $ownRates,
        );
    }

    /** @return list<WorkedShift> */
    public function worked(Event $event, DateTimeImmutable $now): array
    {
        $attendances = Dict\from_entries(Vec\map(
            $this->shiftAttendanceRepository->findOnEvent($event),
            static fn (ShiftAttendance $one): array => [HoursWorked::placeKey($one->getShift(), $one->getStaffMember()->getId()->toRfc4122()), $one],
        ));

        return Vec\flat_map($this->staffShiftRepository->findOnEvent($event), static fn (StaffShift $shift): array => Vec\map($shift->getPeople(), static function ($person) use ($shift, $attendances, $now): WorkedShift {
            $attendance = $attendances[HoursWorked::placeKey($shift, $person->getId()->toRfc4122())] ?? null;

            return HoursWorked::of($shift->getJob()->getId()->toRfc4122(), $person->getId()->toRfc4122(), ClockWindow::endOf($shift), $attendance?->countedIn(), $attendance?->countedOut(), $now);
        }));
    }

    /**
     * After the event: an hourly rate on the minutes clocked, a flat fee once for each person who worked, and nothing for a place nobody worked.
     *
     * @param list<string>           $jobs     in the event's order
     * @param list<WorkedShift>      $worked
     * @param array<string, PayRate> $jobRates by job
     * @param array<string, PayRate> $ownRates by person
     */
    public static function pricedWorked(array $jobs, array $worked, array $jobRates, array $ownRates): WorkedCost
    {
        $own = [];
        $costs = Vec\map($jobs, static function (string $job) use ($worked, $jobRates, $ownRates, &$own): JobWorked {
            $its = Vec\filter($worked, static fn (WorkedShift $shift): bool => $shift->job === $job);
            $minutesOf = static fn (string $person): int => Iter\reduce($its, static fn (int $sum, WorkedShift $shift): int => $sum + ($shift->person === $person ? $shift->minutes : 0), 0);
            $workers = Vec\unique(Vec\map(Vec\filter($its, static fn (WorkedShift $shift): bool => $shift->worked()), static fn (WorkedShift $shift): string => $shift->person));
            $onJobRate = Vec\filter($workers, static fn (string $person): bool => !Iter\contains_key($ownRates, $person));
            $ownCost = 0;

            foreach (Vec\filter($workers, static fn (string $person): bool => Iter\contains_key($ownRates, $person)) as $person) {
                $theirs = $ownRates[$person];
                $minutes = $minutesOf($person);
                $cost = StaffPay::Hourly === $theirs->pay ? self::hourly($theirs->minor, $minutes) : $theirs->minor;
                $own[] = new OwnWorked($person, $job, $minutes, $cost);
                $ownCost += $cost;
            }

            $rate = $jobRates[$job] ?? null;
            $rateMinutes = Iter\reduce($onJobRate, static fn (int $sum, string $person): int => $sum + $minutesOf($person), 0);

            return new JobWorked(
                $job,
                Iter\reduce($its, static fn (int $sum, WorkedShift $shift): int => $sum + $shift->minutes, 0),
                Iter\reduce($its, static fn (int $sum, WorkedShift $shift): int => $sum + $shift->assumedMinutes, 0),
                Iter\count(Vec\filter($its, static fn (WorkedShift $shift): bool => HoursMark::NoAttendance === $shift->mark)),
                Iter\count($workers),
                match (true) {
                    null === $rate => null,
                    StaffPay::Flat === $rate->pay => $ownCost + (Iter\count($onJobRate) * $rate->minor),
                    default => $ownCost + self::hourly($rate->minor, $rateMinutes),
                },
            );
        });

        return new WorkedCost(
            Iter\reduce($costs, static fn (int $sum, JobWorked $job): int => $sum + ($job->costMinor ?? 0), 0),
            Iter\reduce($costs, static fn (int $sum, JobWorked $job): int => $sum + $job->minutes, 0),
            Iter\reduce($costs, static fn (int $sum, JobWorked $job): int => $sum + $job->assumedMinutes, 0),
            Iter\reduce($costs, static fn (int $sum, JobWorked $job): int => $sum + $job->noAttendance, 0),
            $costs,
            $own,
        );
    }

    /** @return array{jobs: array<string, PayRate>, own: array<string, PayRate>, jobOf: array<string, string>} */
    private function rates(Event $event): array
    {
        $jobRates = [];
        $ownRates = [];
        $jobOf = [];

        foreach ($this->staffRateRepository->findOnEvent($event) as $rate) {
            $paid = new PayRate($rate->getPay(), $rate->getAmountMinor());
            $job = $rate->getJob();
            $person = $rate->getPerson();

            if (null !== $job) {
                $jobRates[$job->getId()->toRfc4122()] = $paid;
            } elseif (null !== $person) {
                $ownRates[$person->getId()->toRfc4122()] = $paid;
                $jobOf[$person->getId()->toRfc4122()] = $person->getJob()?->getId()->toRfc4122();
            }
        }

        return ['jobs' => $jobRates, 'own' => $ownRates, 'jobOf' => Dict\filter_nulls($jobOf)];
    }

    /** @return list<StaffRate> */
    public function ratesOf(Event $event): array
    {
        return $this->staffRateRepository->findOnEvent($event);
    }

    public static function scheduled(StaffShift $shift, Event $event): ScheduledShift
    {
        return new ScheduledShift(
            $shift->getJob()->getId()->toRfc4122(),
            Math\div(ShiftClock::seconds($shift->getStartsAt(), $shift->getEndsAt(), $event), 60),
            $shift->getNeeded(),
            Vec\map($shift->getPeople(), static fn ($person): string => $person->getId()->toRfc4122()),
        );
    }

    /**
     * @param list<string>           $jobs     in the event's order
     * @param list<ScheduledShift>   $shifts
     * @param array<string, PayRate> $jobRates by job
     * @param array<string, PayRate> $ownRates by person
     * @param array<string, string>  $jobOf    each person on their own rate, their job
     */
    public static function priced(array $jobs, array $shifts, array $jobRates, array $ownRates, array $jobOf): StaffCost
    {
        $own = [];
        $costs = Vec\map($jobs, static function (string $job) use ($shifts, $jobRates, $ownRates, &$own): JobCost {
            $its = Vec\filter($shifts, static fn (ScheduledShift $shift): bool => $shift->job === $job);
            $people = Vec\unique(Vec\flat_map($its, static fn (ScheduledShift $shift): array => $shift->people));
            $openPlaces = Iter\reduce($its, static fn (int $sum, ScheduledShift $shift): int => $sum + $shift->openPlaces(), 0);
            $rate = $jobRates[$job] ?? null;
            $ownCost = 0;
            $keepOwn = [];

            foreach ($people as $person) {
                $theirs = $ownRates[$person] ?? null;

                if (null === $theirs) {
                    continue;
                }

                $minutes = Iter\reduce($its, static fn (int $sum, ScheduledShift $shift): int => $sum + (Iter\contains($shift->people, $person) ? $shift->minutes : 0), 0);
                $cost = match (true) {
                    StaffPay::Hourly === $theirs->pay => self::hourly($theirs->minor, $minutes),
                    $minutes > 0 => $theirs->minor,
                    default => 0,
                };
                $own[] = new OwnCost($person, $job, $theirs, $minutes, $cost);
                $ownCost += $cost;
                $keepOwn[] = $person;
            }

            $rateMinutes = Iter\reduce($its, static fn (int $sum, ScheduledShift $shift): int => $sum + ($shift->minutes * ($shift->openPlaces() + Iter\count(Vec\filter($shift->people, static fn (string $person): bool => !Iter\contains_key($ownRates, $person))))), 0);
            $fees = Iter\count(Vec\filter($people, static fn (string $person): bool => !Iter\contains_key($ownRates, $person))) + $openPlaces;
            $cost = match (true) {
                null === $rate => null,
                StaffPay::Flat === $rate->pay => $ownCost + ($fees * $rate->minor),
                default => $ownCost + self::hourly($rate->minor, $rateMinutes),
            };

            return new JobCost(
                $job,
                $rate,
                Iter\reduce($its, static fn (int $sum, ScheduledShift $shift): int => $sum + ($shift->minutes * $shift->needed), 0),
                Iter\count($its),
                $openPlaces,
                $people,
                $cost,
                $rateMinutes,
                $fees,
                Vec\filter($people, static fn (string $person): bool => Iter\count(Vec\filter($its, static fn (ScheduledShift $shift): bool => Iter\contains($shift->people, $person))) > 1),
                $keepOwn,
            );
        });

        foreach ($jobOf as $person => $job) {
            $theirs = $ownRates[$person] ?? null;

            if (null !== $theirs && !Iter\any($own, static fn (OwnCost $listed): bool => $listed->person === $person)) {
                $own[] = new OwnCost($person, $job, $theirs, 0, 0);
            }
        }

        return new StaffCost(
            Iter\reduce($costs, static fn (int $sum, JobCost $job): int => $sum + ($job->costMinor ?? 0), 0),
            Iter\reduce($costs, static fn (int $sum, JobCost $job): int => $sum + (null === $job->rate ? 0 : $job->scheduledMinutes), 0),
            Iter\reduce($costs, static fn (int $sum, JobCost $job): int => $sum + $job->scheduledMinutes, 0),
            $costs,
            $own,
            Iter\reduce($shifts, static function (array $sum, ScheduledShift $shift): array {
                foreach ($shift->people as $person) {
                    $sum[$person] = ($sum[$person] ?? 0) + $shift->minutes;
                }

                return $sum;
            }, []),
        );
    }

    /** Half up to the minor unit. */
    private static function hourly(int $minorAnHour, int $minutes): int
    {
        return (int) (string) new Number($minorAnHour)->mul($minutes)->mul(2)->add(60)->div(120, 0);
    }
}
