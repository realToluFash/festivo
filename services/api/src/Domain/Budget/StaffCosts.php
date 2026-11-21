<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\JobCost;
use App\Domain\Budget\Model\OwnCost;
use App\Domain\Budget\Model\PayRate;
use App\Domain\Budget\Model\ScheduledShift;
use App\Domain\Budget\Model\StaffCost;
use App\Domain\Staff\ShiftClock;
use App\Entity\Event;
use App\Entity\StaffRate;
use App\Entity\StaffShift;
use App\Enum\StaffPay;
use App\Repository\StaffJobRepository;
use App\Repository\StaffRateRepository;
use App\Repository\StaffShiftRepository;
use BcMath\Number;
use Psl\Iter;
use Psl\Math;
use Psl\Vec;

/** The one place an event's scheduled hours and staff cost are worked out (sc-101): a shift counts once for every place it needs, taken or not. */
final readonly class StaffCosts
{
    public function __construct(
        private StaffJobRepository $staffJobRepository,
        private StaffShiftRepository $staffShiftRepository,
        private StaffRateRepository $staffRateRepository,
    ) {
    }

    public function of(Event $event): StaffCost
    {
        $rates = $this->staffRateRepository->findOnEvent($event);
        $jobRates = [];
        $ownRates = [];

        foreach ($rates as $rate) {
            $paid = new PayRate($rate->getPay(), $rate->getAmountMinor());
            $job = $rate->getJob();
            $person = $rate->getPerson();

            if (null !== $job) {
                $jobRates[$job->getId()->toRfc4122()] = $paid;
            } elseif (null !== $person) {
                $ownRates[$person->getId()->toRfc4122()] = $paid;
            }
        }

        return self::priced(
            Vec\map($this->staffJobRepository->findOnEvent($event), static fn ($job): string => $job->getId()->toRfc4122()),
            Vec\map($this->staffShiftRepository->findOnEvent($event), static fn (StaffShift $shift): ScheduledShift => self::scheduled($shift, $event)),
            $jobRates,
            $ownRates,
        );
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
     */
    public static function priced(array $jobs, array $shifts, array $jobRates, array $ownRates): StaffCost
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
