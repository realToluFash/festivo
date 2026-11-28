<?php

declare(strict_types=1);

namespace App\Domain\Budget\Http;

use App\Domain\Budget\Model\JobCost;
use App\Domain\Budget\Model\JobWorked;
use App\Domain\Budget\Model\OwnCost;
use App\Domain\Budget\Model\OwnWorked;
use App\Domain\Budget\Model\PayRate;
use App\Domain\Budget\Model\StaffCost;
use App\Domain\Budget\StaffCosts;
use App\Entity\Event;
use App\Entity\StaffJob;
use App\Entity\StaffMember;
use App\Entity\StaffRate;
use App\Enum\EventPhase;
use App\Locale\Money;
use App\Repository\StaffJobRepository;
use App\Repository\StaffMemberRepository;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;

/**
 * Budget / Staff rates (sc-101), worked out on every read because a shift moving moves it. `changed.by` is null once the member who set it is gone.
 *
 * @phpstan-type Named array{id: string, name: string}
 * @phpstan-type Rate array{kind: string, amount: string}
 * @phpstan-type Changed array{by: ?string, at: string}
 * @phpstan-type Headline array{total: string, countedMinutes: int, scheduledMinutes: int, unrated: list<array{job: Named, minutes: int}>}
 * @phpstan-type JobWorkedShape array{minutes: int, assumedMinutes: int, noAttendance: int, people: int, cost: ?string}
 * @phpstan-type Job array{id: string, name: string, rate: ?Rate, changed: ?Changed, scheduledMinutes: int, shifts: int, openPlaces: int, people: int, cost: ?string, rateMinutes: int, fees: int, paidOnce: list<string>, keepOwn: list<string>, worked: ?JobWorkedShape}
 * @phpstan-type Own array{member: Named, job: Named, rate: Rate, changed: ?Changed, minutes: int, cost: string, worked: ?array{minutes: int, cost: string}}
 * @phpstan-type Worked array{total: string, minutes: int, scheduledMinutes: int, assumedMinutes: int, noAttendance: int}
 * @phpstan-type Page array{currency: string, headline: Headline, worked: ?Worked, jobs: list<Job>, own: list<Own>, candidates: list<array{member: Named, job: Named, minutes: int}>}
 *
 * Once the event has ended, `worked` and each row's `worked` give the hours clocked beside the scheduled ones (sc-234); the headline stays the scheduled cost.
 */
final readonly class StaffRatesSerialiser
{
    public function __construct(
        private StaffCosts $staffCosts,
        private StaffJobRepository $staffJobRepository,
        private StaffMemberRepository $staffMemberRepository,
        private ClockInterface $clock,
    ) {
    }

    /** @return Page */
    public function page(Event $event): array
    {
        $currency = $event->getCurrency();
        $staff = $this->staffCosts->of($event);
        $jobs = Dict\from_entries(Vec\map($this->staffJobRepository->findOnEvent($event), static fn (StaffJob $job): array => [$job->getId()->toRfc4122(), $job]));
        $people = Dict\from_entries(Vec\map($this->staffMemberRepository->findOnEvent($event), static fn (StaffMember $person): array => [$person->getId()->toRfc4122(), $person]));
        $jobRates = [];
        $ownRates = [];

        foreach ($this->staffCosts->ratesOf($event) as $rate) {
            $job = $rate->getJob()?->getId()->toRfc4122();
            $person = $rate->getPerson()?->getId()->toRfc4122();

            if (null !== $job) {
                $jobRates[$job] = $rate;
            } elseif (null !== $person) {
                $ownRates[$person] = $rate;
            }
        }

        $name = static fn (string $person): string => ($people[$person] ?? null)?->getFullName() ?? '';
        $named = static fn (string $id, string $label): array => ['id' => $id, 'name' => $label];
        $onShifts = Vec\unique(Vec\flat_map($staff->jobs, static fn (JobCost $job): array => $job->people));
        $now = $this->clock->now();
        $ended = EventPhase::Finished === EventPhase::of($event->getStatus(), $event->getStartsAt(), $event->getEndsAt(), $now) || $now >= $event->getEndsAt();
        $worked = $ended ? $this->staffCosts->workedOf($event, $now) : null;
        $jobWorked = null === $worked ? [] : Dict\from_entries(Vec\map($worked->jobs, static fn (JobWorked $job): array => [$job->job, $job]));
        $ownWorked = null === $worked ? [] : Dict\from_entries(Vec\map($worked->own, static fn (OwnWorked $own): array => [$own->person . ':' . $own->job, $own]));

        return [
            'currency' => $currency,
            'headline' => $this->headline($event, $staff),
            'worked' => null === $worked ? null : [
                'total' => Money::written($worked->totalMinor, $currency),
                'minutes' => $worked->minutes,
                'scheduledMinutes' => $staff->scheduledMinutes,
                'assumedMinutes' => $worked->assumedMinutes,
                'noAttendance' => $worked->noAttendance,
            ],
            'jobs' => Vec\map($staff->jobs, static fn (JobCost $job): array => [
                'id' => $job->job,
                'name' => ($jobs[$job->job] ?? null)?->getName() ?? '',
                'rate' => null === $job->rate ? null : self::rate($job->rate, $currency),
                'changed' => null === ($jobRates[$job->job] ?? null) ? null : self::changed($jobRates[$job->job]),
                'scheduledMinutes' => $job->scheduledMinutes,
                'shifts' => $job->shifts,
                'openPlaces' => $job->openPlaces,
                'people' => Iter\count($job->people),
                'cost' => null === $job->costMinor ? null : Money::written($job->costMinor, $currency),
                'rateMinutes' => $job->rateMinutes,
                'fees' => $job->fees,
                'paidOnce' => Vec\map($job->paidOnce, $name),
                'keepOwn' => Vec\map($job->keepOwn, $name),
                'worked' => null === $worked ? null : self::jobWorked($jobWorked[$job->job] ?? null, $currency),
            ]),
            'own' => Vec\map($staff->own, static fn (OwnCost $own): array => [
                'member' => $named($own->person, $name($own->person)),
                'job' => $named($own->job, ($jobs[$own->job] ?? null)?->getName() ?? ''),
                'rate' => self::rate($own->rate, $currency),
                'changed' => null === ($ownRates[$own->person] ?? null) ? null : self::changed($ownRates[$own->person]),
                'minutes' => $own->minutes,
                'cost' => Money::written($own->costMinor, $currency),
                'worked' => null === $worked ? null : [
                    'minutes' => ($ownWorked[$own->person . ':' . $own->job] ?? null)?->minutes ?? 0,
                    'cost' => Money::written(($ownWorked[$own->person . ':' . $own->job] ?? null)?->costMinor ?? 0, $currency),
                ],
            ]),
            'candidates' => Vec\filter_nulls(Vec\map($onShifts, static function (string $person) use ($people, $ownRates, $named, $staff): ?array {
                $who = $people[$person] ?? null;
                $job = $who?->getJob();

                return null === $who || null === $job || isset($ownRates[$person])
                    ? null
                    : ['member' => $named($person, $who->getFullName()), 'job' => $named($job->getId()->toRfc4122(), $job->getName()), 'minutes' => $staff->minutesOf[$person] ?? 0];
            })),
        ];
    }

    /** @return Headline */
    public function headline(Event $event, StaffCost $staff): array
    {
        $jobs = Dict\from_entries(Vec\map($this->staffJobRepository->findOnEvent($event), static fn (StaffJob $job): array => [$job->getId()->toRfc4122(), $job->getName()]));

        return [
            'total' => Money::written($staff->totalMinor, $event->getCurrency()),
            'countedMinutes' => $staff->countedMinutes,
            'scheduledMinutes' => $staff->scheduledMinutes,
            'unrated' => Vec\map($staff->unrated(), static fn (JobCost $job): array => [
                'job' => ['id' => $job->job, 'name' => $jobs[$job->job] ?? ''],
                'minutes' => $job->scheduledMinutes,
            ]),
        ];
    }

    /** @return JobWorkedShape */
    private static function jobWorked(?JobWorked $job, string $currency): array
    {
        return [
            'minutes' => $job?->minutes ?? 0,
            'assumedMinutes' => $job?->assumedMinutes ?? 0,
            'noAttendance' => $job?->noAttendance ?? 0,
            'people' => $job?->people ?? 0,
            'cost' => null === $job?->costMinor ? null : Money::written($job->costMinor, $currency),
        ];
    }

    /** @return Rate */
    private static function rate(PayRate $rate, string $currency): array
    {
        return ['kind' => $rate->pay->value, 'amount' => Money::written($rate->minor, $currency)];
    }

    /** @return Changed */
    private static function changed(StaffRate $rate): array
    {
        return ['by' => $rate->getSetBy()?->getName(), 'at' => $rate->getSetAt()->format(\DATE_ATOM)];
    }
}
