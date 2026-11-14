<?php

declare(strict_types=1);

namespace App\Domain\Guest\Headcount;

use App\Domain\Guest\Http\GuestSerialiser;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\GuestGroup;
use App\Enum\GuestReply;
use App\Enum\GuestStanding;
use App\Enum\NeedKind;
use App\Repository\GuestGroupRepository;
use App\Repository\GuestNeedRepository;
use App\Repository\GuestRepository;
use Psl\Iter;
use Psl\Vec;

/**
 * By group (sc-3775): each of the event's groups, A to Z, then No group while anyone is in none, so the rows add up to `counts`.
 *
 * @phpstan-type Counts array{onList: int, notYetInvited: int, invited: int, accepted: int, maybe: int, awaitingReply: int, held: int, heldBy: array{hostNoReply: int, hostMaybe: int, hostNotComing: int}, declined: int}
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
        $counts = self::counts(...Vec\map($everybody, self::standing(...)));
        $groupOf = static fn (Guest $person): ?GuestGroup => ($person->getHost() ?? $person)->getGroup();
        $countIn = static fn (?GuestGroup $group): array => self::counts(...Vec\map(Vec\filter($everybody, static fn (Guest $person): bool => $groupOf($person) === $group), self::standing(...)));
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
    public static function counts(GuestStanding ...$standings): array
    {
        $count = static fn (GuestStanding ...$any): int => Iter\count(Vec\filter($standings, static fn (GuestStanding $standing): bool => Iter\contains($any, $standing)));
        $heldBy = [
            'hostNoReply' => $count(GuestStanding::HeldHostNoReply),
            'hostMaybe' => $count(GuestStanding::HeldHostMaybe),
            'hostNotComing' => $count(GuestStanding::HeldHostNotComing),
        ];

        return [
            'onList' => Iter\count($standings),
            'notYetInvited' => $count(GuestStanding::NotYetInvited),
            'invited' => Iter\count($standings) - $count(GuestStanding::NotYetInvited),
            'accepted' => $count(GuestStanding::Accepted),
            'maybe' => $count(GuestStanding::Maybe),
            'awaitingReply' => $count(GuestStanding::AwaitingReply),
            'held' => $heldBy['hostNoReply'] + $heldBy['hostMaybe'] + $heldBy['hostNotComing'],
            'heldBy' => $heldBy,
            'declined' => $count(GuestStanding::Declined),
        ];
    }

    public static function standing(Guest $person): GuestStanding
    {
        $host = $person->getHost();
        $decides = $host ?? $person;

        return GuestStanding::of($decides->getReply() ?? GuestReply::NoReply, null !== $host, $decides->isInvited(), $person->isNotComingByGuest());
    }
}
