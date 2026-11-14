<?php

declare(strict_types=1);

namespace App\Domain\Guest\Headcount;

use App\Entity\Event;
use App\Entity\Guest;
use App\Enum\GuestReply;
use App\Enum\GuestStanding;
use App\Enum\NeedKind;
use App\Repository\GuestNeedRepository;
use App\Repository\GuestRepository;
use Psl\Iter;
use Psl\Vec;

/**
 * @phpstan-type Counts array{onList: int, notYetInvited: int, invited: int, accepted: int, maybe: int, awaitingReply: int, held: int, heldBy: array{hostNoReply: int, hostMaybe: int, hostNotComing: int}, declined: int}
 * @phpstan-type Headcount array{counts: Counts, byGroup: list<array{group: null, counts: Counts}>, byDietaryNeed: array{addsUp: false, needs: list<NeedCount>}}
 * @phpstan-type NeedCount array{kind: value-of<NeedKind>, code: string, people: int}
 */
final readonly class HeadcountCalculator
{
    public function __construct(
        private GuestRepository $guestRepository,
        private GuestNeedRepository $guestNeedRepository,
    ) {
    }

    /** @return Headcount */
    public function forEvent(Event $event): array
    {
        $standings = Vec\map($this->guestRepository->findOnList($event), self::standing(...));
        $counts = self::counts(...$standings);

        return [
            'counts' => $counts,
            'byGroup' => [] === $standings ? [] : [['group' => null, 'counts' => $counts]],
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
            'notYetInvited' => 0,
            'invited' => Iter\count($standings),
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

        return GuestStanding::of(($host ?? $person)->getReply() ?? GuestReply::NoReply, null !== $host);
    }
}
