<?php

declare(strict_types=1);

namespace App\Domain\Guest\Headcount;

use App\Entity\Event;
use App\Entity\Guest;
use App\Enum\GuestReply;
use App\Enum\GuestStanding;
use App\Repository\GuestRepository;
use Psl\Iter;
use Psl\Vec;

/**
 * @phpstan-type Counts array{onList: int, notYetInvited: int, invited: int, accepted: int, maybe: int, awaitingReply: int, held: int, heldBy: array{hostNoReply: int, hostMaybe: int, hostNotComing: int}, declined: int}
 * @phpstan-type Headcount array{counts: Counts, byGroup: list<array{group: null, counts: Counts}>, byDietaryNeed: array{addsUp: false, needs: list<never>}}
 */
final readonly class HeadcountCalculator
{
    public function __construct(
        private GuestRepository $guestRepository,
    ) {
    }

    /** @return Headcount */
    public function forEvent(Event $event): array
    {
        return self::headcount(...Vec\map($this->guestRepository->findOnList($event), self::standing(...)));
    }

    /** @return Headcount */
    public static function headcount(GuestStanding ...$standings): array
    {
        $counts = self::counts(...$standings);

        return [
            'counts' => $counts,
            'byGroup' => [] === $standings ? [] : [['group' => null, 'counts' => $counts]],
            'byDietaryNeed' => ['addsUp' => false, 'needs' => []],
        ];
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

        return GuestStanding::of($decides->getReply() ?? GuestReply::NoReply, null !== $host, $decides->isInvited());
    }
}
