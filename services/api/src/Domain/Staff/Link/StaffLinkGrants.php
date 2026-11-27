<?php

declare(strict_types=1);

namespace App\Domain\Staff\Link;

use App\Entity\EventPerson;
use App\Entity\ShiftAttendance;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\StaffAccess;
use App\Repository\EventPersonRepository;
use App\Repository\ShiftAttendanceRepository;
use App\Repository\StaffMemberRepository;
use DateTimeImmutable;
use Psl\Iter;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** A staff link's sign-in holds the job's level for the link's window (sc-4235), read from the roster entry on every request, never copied at sign-in. */
final readonly class StaffLinkGrants
{
    public function __construct(
        private StaffMemberRepository $staffMemberRepository,
        private EventPersonRepository $eventPersonRepository,
        private ShiftAttendanceRepository $shiftAttendanceRepository,
        private StaffLinks $staffLinks,
        private ClockInterface $clock,
    ) {
    }

    public function onEvent(User $user, Uuid $eventId): ?EventRole
    {
        $entry = Iter\first($this->live($user, $eventId));

        return null === $entry ? null : self::levelOf($entry['entry']);
    }

    /** @return list<array{entry: StaffMember, until: DateTimeImmutable}> soonest event first */
    public function live(User $user, ?Uuid $eventId = null): array
    {
        $live = [];

        foreach ($this->staffMemberRepository->findSignedInAs($user, $this->clock->now(), $eventId) as $entry) {
            $window = $this->staffLinks->window($entry);

            if ($window->open && null !== $window->until) {
                $live[] = ['entry' => $entry, 'until' => $window->until];
            }
        }

        return $live;
    }

    /** Whether a staff link of the account's on the event ended only because the event did. */
    public function endedWithTheEvent(User $user, Uuid $eventId): bool
    {
        return Iter\any($this->staffMemberRepository->findSignedInAs($user, $this->clock->now(), $eventId), $this->staffLinks->endedWithTheEvent(...));
    }

    /** @return list<array{entry: StaffMember, until: DateTimeImmutable, level: EventRole}> a join code's shift opens its night at the code's level, never the job's (sc-234) */
    public function byCode(User $user, Uuid $eventId): array
    {
        $person = $this->eventPersonRepository->findLiveOutside($eventId, $user, $this->clock->now());
        $shift = $person?->getDoorCode()?->getShift();
        $entry = null === $shift ? null : Iter\first(Vec\filter($shift->getPeople(), static fn (StaffMember $one): bool => true === $one->getAccount()?->getId()->equals($user->getId())));

        if (null === $person || null === $entry) {
            return [];
        }

        $window = $this->staffLinks->window($entry);

        return $window->open && null !== $window->until ? [['entry' => $entry, 'until' => $window->until, 'level' => $person->getRole()]] : [];
    }

    /**
     * Past their access, still clocked in (sc-234): the entries whose link opens the clock card alone, and until when. No grant comes with it.
     *
     * @return list<array{entry: StaffMember, until: DateTimeImmutable}>
     */
    public function clockOnly(User $user, ?Uuid $eventId = null): array
    {
        $entries = Vec\unique_by(
            Vec\filter_nulls(Vec\map($this->shiftAttendanceRepository->findOpenOfAccount($user, $eventId), static fn (ShiftAttendance $attendance): ?StaffMember => $attendance->getStaffMember())),
            static fn (StaffMember $entry): string => $entry->getId()->toRfc4122(),
        );
        $open = [];

        foreach ($entries as $entry) {
            $until = $this->staffLinks->window($entry)->clockUntil;

            if (null !== $until) {
                $open[] = ['entry' => $entry, 'until' => $until];
            }
        }

        return $open;
    }

    /** @return list<OutsideEvent> every event the account reaches from outside, the grants from outside first (the first is where it lands), then its staff links */
    public function liveOutsideEvents(User $user): array
    {
        return [
            ...Vec\map($this->eventPersonRepository->findLiveOutsideFor($user, $this->clock->now()), static fn (EventPerson $person): OutsideEvent => new OutsideEvent($person->getEvent(), $person->getRole(), $person->getJobLabel(), $person->getEvent()->getClosesAt())),
            ...Vec\map($this->live($user), static fn (array $grant): OutsideEvent => new OutsideEvent($grant['entry']->getEvent(), self::levelOf($grant['entry']), $grant['entry']->getJob()?->getName(), $grant['until'])),
        ];
    }

    /** When a browser signed in by phone code is signed out: the last of the account's live grants to end, a clock card past access included, or null once none is live. */
    public function lastEndFor(User $user): ?DateTimeImmutable
    {
        $ends = [
            ...Vec\filter_nulls(Vec\map($this->liveOutsideEvents($user), static fn (OutsideEvent $outside): ?DateTimeImmutable => $outside->until)),
            ...Vec\map($this->clockOnly($user), static fn (array $grant): DateTimeImmutable => $grant['until']),
        ];

        return Iter\reduce($ends, static fn (?DateTimeImmutable $last, DateTimeImmutable $end): DateTimeImmutable => null === $last || $end > $last ? $end : $last, null);
    }

    public static function levelOf(StaffMember $entry): EventRole
    {
        return ($entry->getJob()?->getAccess() ?? StaffAccess::View)->eventRole();
    }
}
