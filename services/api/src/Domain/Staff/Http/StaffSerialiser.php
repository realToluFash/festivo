<?php

declare(strict_types=1);

namespace App\Domain\Staff\Http;

use App\Domain\Staff\RosterOrder;
use App\Domain\Staff\ShiftClock;
use App\Entity\Event;
use App\Entity\StaffJob;
use App\Entity\StaffMember;
use App\Entity\StaffShift;
use App\Repository\StaffJobRepository;
use App\Repository\StaffMemberRepository;
use App\Repository\StaffShiftRepository;
use Psl\Vec;

/** `link` says only `none`, `no_mobile` or `erased` until sc-3912 sends links; station stays null until sc-3910. Every time is the instant, with the event's offset. */
final readonly class StaffSerialiser
{
    public function __construct(
        private StaffMemberRepository $staffMemberRepository,
        private StaffJobRepository $staffJobRepository,
        private StaffShiftRepository $staffShiftRepository,
    ) {
    }

    /** @return array{staff: list<array<string, mixed>>, jobs: list<array<string, mixed>>, shifts: list<array<string, mixed>>} */
    public function list(Event $event): array
    {
        $shifts = $this->staffShiftRepository->findOnEvent($event);
        $theirs = [];

        foreach ($shifts as $shift) {
            foreach ($shift->getPeople() as $person) {
                $theirs[$person->getId()->toRfc4122()][] = $shift;
            }
        }

        return [
            'staff' => Vec\map(
                RosterOrder::sort($this->staffMemberRepository->findOnEvent($event), $theirs),
                fn (StaffMember $entry): array => $this->entry($entry, $theirs[$entry->getId()->toRfc4122()] ?? []),
            ),
            'jobs' => Vec\map($this->staffJobRepository->findOnEvent($event), self::job(...)),
            'shifts' => Vec\map($shifts, self::shift(...)),
        ];
    }

    /**
     * @param ?list<StaffShift> $shifts the person's shifts by start, read when null
     *
     * @return array<string, mixed>
     */
    public function entry(StaffMember $entry, ?array $shifts = null): array
    {
        $event = $entry->getEvent();
        $job = $entry->getJob();

        return [
            'id' => $entry->getId()->toRfc4122(),
            'fullName' => $entry->getFullName(),
            'mobile' => $entry->getMobile(),
            'email' => $entry->getEmail(),
            'job' => null === $job ? null : ['id' => $job->getId()->toRfc4122(), 'name' => $job->getName()],
            'station' => null,
            'shifts' => Vec\map(
                $shifts ?? $this->staffShiftRepository->findOfPerson($entry),
                static fn (StaffShift $shift): array => [
                    'id' => $shift->getId()->toRfc4122(),
                    'startsAt' => ShiftClock::instant($shift->getStartsAt(), $event)->format(\DATE_ATOM),
                    'endsAt' => ShiftClock::instant($shift->getEndsAt(), $event)->format(\DATE_ATOM),
                ],
            ),
            'link' => match (true) {
                null !== $entry->getContactsErasedAt() => 'erased',
                null === $entry->getMobile() => 'no_mobile',
                default => 'none',
            },
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
