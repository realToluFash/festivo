<?php

declare(strict_types=1);

namespace App\Domain\Staff\Link;

use App\Entity\EventPerson;
use App\Entity\StaffMember;
use App\Entity\User;
use App\Enum\EventRole;
use App\Enum\StaffAccess;
use App\Repository\EventPersonRepository;
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

    /** When a browser signed in by phone code is signed out: the last of the account's live grants to end, or null once none is live. */
    public function lastEndFor(User $user): ?DateTimeImmutable
    {
        $ends = [
            ...Vec\map($this->live($user), static fn (array $grant): DateTimeImmutable => $grant['until']),
            ...Vec\filter_nulls(Vec\map($this->eventPersonRepository->findLiveOutsideFor($user, $this->clock->now()), static fn (EventPerson $person): ?DateTimeImmutable => $person->getEvent()->getClosesAt())),
        ];

        return Iter\reduce($ends, static fn (?DateTimeImmutable $last, DateTimeImmutable $end): DateTimeImmutable => null === $last || $end > $last ? $end : $last, null);
    }

    public static function levelOf(StaffMember $entry): EventRole
    {
        return ($entry->getJob()?->getAccess() ?? StaffAccess::View)->eventRole();
    }
}
