<?php

declare(strict_types=1);

namespace App\Domain\Guest\Headcount;

use App\Domain\Guest\Http\GuestSerialiser;
use App\Domain\Guest\Model\CountedPerson;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\GuestGroup;
use App\Enum\GuestReply;
use App\Enum\GuestStanding;
use App\Enum\NeedKind;
use App\Repository\GuestGroupRepository;
use App\Repository\GuestNeedRepository;
use App\Repository\GuestRepository;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;

/**
 * By group (sc-3775): each of the event's groups, A to Z, then No group while anyone is in none, so the rows add up to `counts`.
 *
 * Attended is everyone arrived, walk-ins included; expected is accepted plus everyone attended who is not in it, so attended never exceeds it (sc-1454).
 *
 * @phpstan-type Counts array{onList: int, notYetInvited: int, invited: int, walkIns: int, accepted: int, maybe: int, awaitingReply: int, held: int, heldBy: array{hostNoReply: int, hostMaybe: int, hostNotComing: int}, declined: int, attended: int, expected: int}
 * @phpstan-type Headcount array{counts: Counts, byGroup: list<array{group: ?array{id: string, name: string}, counts: Counts}>, byDietaryNeed: array{addsUp: false, needs: list<NeedCount>}}
 * @phpstan-type NeedCount array{kind: value-of<NeedKind>, code: string, people: int}
 */
final readonly class HeadcountCalculator
{
    public function __construct(
        private GuestRepository $guestRepository,
        private GuestNeedRepository $guestNeedRepository,
        private GuestGroupRepository $guestGroupRepository,
    ) {
    }

    /** @return Headcount */
    public function forEvent(Event $event): array
    {
        $everybody = $this->guestRepository->findOnList($event);
        $counts = self::counts(...Vec\map($everybody, self::counted(...)));
        $groupOf = static fn (Guest $person): ?GuestGroup => ($person->getHost() ?? $person)->getGroup();
        $countIn = static fn (?GuestGroup $group): array => self::counts(...Vec\map(Vec\filter($everybody, static fn (Guest $person): bool => $groupOf($person) === $group), self::counted(...)));
        $ungrouped = Iter\any($everybody, static fn (Guest $person): bool => null === $groupOf($person));

        return [
            'counts' => $counts,
            'byGroup' => [
                ...Vec\map($this->guestGroupRepository->findOnEvent($event), static fn (GuestGroup $group): array => ['group' => GuestSerialiser::group($group), 'counts' => $countIn($group)]),
                ...$ungrouped ? [['group' => null, 'counts' => $countIn(null)]] : [],
            ],
            'byDietaryNeed' => ['addsUp' => false, 'needs' => $this->byNeed($event)],
        ];
    }

    /**
     * Everybody sc-99 counts as coming, in the list's order: a companion their guest marked Not coming and a walk-in are not, and neither is anyone behind a removed guest.
     *
     * @return list<Guest>
     */
    public function coming(Event $event): array
    {
        return Vec\filter($this->guestRepository->findOnList($event), self::isComing(...));
    }

    public static function isComing(Guest $person): bool
    {
        return !$person->isRemoved()
            && !($person->getHost()?->isRemoved() ?? false)
            && GuestStanding::Accepted === self::standing($person);
    }

    /**
     * @param list<Event> $events
     *
     * @return array<string, Counts> by event id
     */
    public function forEvents(array $events): array
    {
        $standings = [];
        foreach ($this->guestRepository->findOnListsOf($events) as $person) {
            $standings[$person->getEvent()->getId()->toRfc4122()][] = self::counted($person);
        }

        return Dict\from_keys(Vec\map($events, static fn (Event $event): string => $event->getId()->toRfc4122()), static fn (string $id): array => self::counts(...($standings[$id] ?? [])));
    }

    /**
     * Events' measure (sc-23284): the companions held behind a guest who owes an answer have not replied either. Today's arrived line reads attended of expected, as Check-in does (sc-29978).
     *
     * @param Counts $counts
     *
     * @return array{invited: int, coming: int, notReplied: int, attended: int, expected: int}
     */
    public static function figures(array $counts): array
    {
        return ['invited' => $counts['invited'], 'coming' => $counts['accepted'], 'notReplied' => $counts['awaitingReply'] + $counts['heldBy']['hostNoReply'], 'attended' => $counts['attended'], 'expected' => $counts['expected']];
    }

    /**
     * The budget's upper figure (sc-84): everybody who has not said Not coming says yes, so a held companion counts unless their host has declined.
     *
     * @param Counts $counts
     */
    public static function ifAllCome(array $counts): int
    {
        return $counts['accepted'] + $counts['maybe'] + $counts['awaitingReply'] + $counts['held'] - $counts['heldBy']['hostNotComing'];
    }

    /**
     * Each code everybody on the list has, in its list's order, allergens first (sc-3777): someone with two counts once under each, so these do not add up.
     *
     * @return list<NeedCount>
     */
    private function byNeed(Event $event): array
    {
        $counted = $this->guestNeedRepository->countByCode($event);

        return Vec\flat_map(NeedKind::cases(), static fn (NeedKind $kind): array => Vec\filter_nulls(Vec\map($kind->codes(), static function (string $code) use ($kind, $counted): ?array {
            $row = Iter\search($counted, static fn (array $one): bool => $kind === $one['kind'] && $code === $one['code']);

            return null === $row ? null : ['kind' => $kind->value, 'code' => $code, 'people' => $row['people']];
        })));
    }

    /** @return Counts */
    public static function counts(CountedPerson ...$people): array
    {
        $standings = Vec\map($people, static fn (CountedPerson $person): GuestStanding => $person->standing);
        $count = static fn (GuestStanding ...$any): int => Iter\count(Vec\filter($standings, static fn (GuestStanding $standing): bool => Iter\contains($any, $standing)));
        $heldBy = [
            'hostNoReply' => $count(GuestStanding::HeldHostNoReply),
            'hostMaybe' => $count(GuestStanding::HeldHostMaybe),
            'hostNotComing' => $count(GuestStanding::HeldHostNotComing),
        ];
        $arrived = Vec\filter($people, static fn (CountedPerson $person): bool => $person->arrived);
        $accepted = $count(GuestStanding::Accepted);

        return [
            'onList' => Iter\count($standings),
            'notYetInvited' => $count(GuestStanding::NotYetInvited),
            'invited' => Iter\count($standings) - $count(GuestStanding::NotYetInvited, GuestStanding::WalkIn),
            'walkIns' => $count(GuestStanding::WalkIn),
            'accepted' => $accepted,
            'maybe' => $count(GuestStanding::Maybe),
            'awaitingReply' => $count(GuestStanding::AwaitingReply),
            'held' => $heldBy['hostNoReply'] + $heldBy['hostMaybe'] + $heldBy['hostNotComing'],
            'heldBy' => $heldBy,
            'declined' => $count(GuestStanding::Declined),
            'attended' => Iter\count($arrived),
            'expected' => $accepted + Iter\count(Vec\filter($arrived, static fn (CountedPerson $person): bool => GuestStanding::Accepted !== $person->standing)),
        ];
    }

    public static function counted(Guest $person): CountedPerson
    {
        return new CountedPerson(self::standing($person), $person->hasArrived());
    }

    public static function standing(Guest $person): GuestStanding
    {
        if ($person->isWalkIn()) {
            return GuestStanding::WalkIn;
        }

        $host = $person->getHost();
        $decides = $host ?? $person;

        return GuestStanding::of($decides->getReply() ?? GuestReply::NoReply, null !== $host, $decides->isInvited(), $person->isNotComingByGuest());
    }
}
