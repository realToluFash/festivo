<?php

declare(strict_types=1);

namespace App\Domain\Staff\Http;

use App\Domain\Staff\Briefing\BriefingTracker;
use App\Domain\Staff\RosterOrder;
use App\Domain\Staff\ShiftClock;
use App\Domain\Staff\Station\StationSerialiser;
use App\Entity\Event;
use App\Entity\StaffJob;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Repository\StaffJobRepository;
use App\Repository\StaffMemberRepository;
use App\Repository\StaffShiftRepository;
use DateTimeZone;
use Psl\Vec;

/** `link` is how far the person's own link got (sc-3912), or `no_mobile` or `erased` when none can be given; `linkBy` and `linkAt` say who moved it and when. `briefing` is where their briefing stands (sc-3917), and `briefingCopy` the last copy of their link from it. Every time is the instant, with the event's offset. */
final readonly class StaffSerialiser
{
    public function __construct(
        private StaffMemberRepository $staffMemberRepository,
        private StaffJobRepository $staffJobRepository,
        private StaffShiftRepository $staffShiftRepository,
        private StationSerialiser $stationSerialiser,
        private BriefingTracker $briefingTracker,
    ) {
    }

    /** @return array{staff: list<array<string, mixed>>, jobs: list<array<string, mixed>>, shifts: list<array<string, mixed>>, stations: array<string, mixed>, rules: ?string} */
    public function list(Event $event): array
    {
        $shifts = $this->staffShiftRepository->findOnEvent($event);
        $theirs = [];

        foreach ($shifts as $shift) {
            foreach ($shift->getPeople() as $person) {
                $theirs[$person->getId()->toRfc4122()][] = $shift;
            }
        }

        $staff = RosterOrder::sort($this->staffMemberRepository->findOnEvent($event), $theirs);
        $tables = $this->stationSerialiser->tables($event);
        $floorLead = $this->staffMemberRepository->findOneBy(['event' => $event, 'floorLead' => true]);

        return [
            'staff' => Vec\map($staff, fn (StaffMember $entry): array => $this->entry($entry, $theirs[$entry->getId()->toRfc4122()] ?? [], $tables, $floorLead)),
            'jobs' => Vec\map($this->staffJobRepository->findOnEvent($event), self::job(...)),
            'shifts' => Vec\map($shifts, self::shift(...)),
            'stations' => $this->stationSerialiser->stations($event, $staff),
            'rules' => $event->getStaffRules(),
        ];
    }

    /**
     * @param ?list<StaffShift>                                     $shifts    the person's shifts by start, read when null
     * @param ?array<string, list<array{id: string, name: string}>> $tables    each seating section's tables, read when null
     * @param ?StaffMember                                          $floorLead the event's floor lead, read when null
     *
     * @return array<string, mixed>
     */
    public function entry(StaffMember $entry, ?array $shifts = null, ?array $tables = null, ?StaffMember $floorLead = null): array
    {
        $event = $entry->getEvent();
        $job = $entry->getJob();
        $shifts ??= $this->staffShiftRepository->findOfPerson($entry);
        $zone = new DateTimeZone($event->getTimeZone());
        $copyAt = $entry->getBriefCopyAt();

        return [
            'id' => $entry->getId()->toRfc4122(),
            'fullName' => $entry->getFullName(),
            'mobile' => $entry->getMobile(),
            'email' => $entry->getEmail(),
            'job' => null === $job ? null : ['id' => $job->getId()->toRfc4122(), 'name' => $job->getName()],
            ...$this->stationSerialiser->person($entry, $tables),
            'shifts' => Vec\map(
                $shifts,
                static fn (StaffShift $shift): array => [
                    'id' => $shift->getId()->toRfc4122(),
                    'startsAt' => ShiftClock::instant($shift->getStartsAt(), $event)->format(\DATE_ATOM),
                    'endsAt' => ShiftClock::instant($shift->getEndsAt(), $event)->format(\DATE_ATOM),
                ],
            ),
            'link' => match (true) {
                null !== $entry->getContactsErasedAt() => 'erased',
                null === $entry->getMobile() => 'no_mobile',
                default => $entry->getLinkStatus()->value,
            },
            'linkBy' => $entry->getLinkBy()?->getName(),
            'linkAt' => $entry->getLinkAt()?->setTimezone($zone)->format(\DATE_ATOM),
            'briefing' => $this->briefingTracker->stateOf($entry, $shifts, $floorLead),
            'briefingCopy' => null === $copyAt ? null : [
                'by' => $entry->getBriefCopyBy()?->getName(),
                'at' => $copyAt->setTimezone($zone)->format(\DATE_ATOM),
                'marked' => $entry->isBriefCopyMarked(),
            ],
            'contactsErased' => null !== $entry->getContactsErasedAt(),
        ];
    }

    /** @return array<string, mixed> */
    private static function job(StaffJob $job): array
    {
        return [
            'id' => $job->getId()->toRfc4122(),
            'name' => $job->getName(),
            'access' => $job->getAccess()->value,
        ];
    }

    /** @return array<string, mixed> */
    private static function shift(StaffShift $shift): array
    {
        $event = $shift->getJob()->getEvent();

        return [
            'id' => $shift->getId()->toRfc4122(),
            'job' => $shift->getJob()->getId()->toRfc4122(),
            'startsAt' => ShiftClock::instant($shift->getStartsAt(), $event)->format(\DATE_ATOM),
            'endsAt' => ShiftClock::instant($shift->getEndsAt(), $event)->format(\DATE_ATOM),
            'needed' => $shift->getNeeded(),
            'people' => Vec\map($shift->getPeople(), static fn (StaffMember $person): string => $person->getId()->toRfc4122()),
        ];
    }
}
