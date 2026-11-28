<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Entity\Guest;
use App\Entity\SeatAssignment;
use App\Enum\GuestReply;
use App\Repository\GuestRepository;
use App\Repository\SeatAssignmentRepository;
use App\Repository\TableSharingRepository;
use Psl\Dict;
use Psl\Vec;

/** What a guest's own page shows of the plan once the tables are shared (sc-4022): their place, and each companion's who sits somewhere else. Never who else is at the table. */
final readonly class SharedSeats
{
    public function __construct(
        private TableSharingRepository $tableSharingRepository,
        private SeatAssignmentRepository $seatAssignmentRepository,
        private GuestRepository $guestRepository,
    ) {
    }

    /**
     * Null before sharing, after Stop sharing, and for a guest who is not Coming or has no seat, so the page's answer carries no seating field.
     *
     * @return ?array{seat: array<string, mixed>, elsewhere: list<array{name: ?string, seat: array<string, mixed>}>}
     */
    public function of(Guest $guest): ?array
    {
        if (GuestReply::Coming !== $guest->getReply() || !($this->tableSharingRepository->findOneForEvent($guest->getEvent())?->isShared() ?? false)) {
            return null;
        }

        $companions = Vec\filter(
            $this->guestRepository->findCompanionsOf($guest),
            static fn (Guest $companion): bool => null === $companion->getRemovedAt() && !$companion->isNotComingByGuest(),
        );
        $assignments = Dict\from_entries(Vec\map(
            $this->seatAssignmentRepository->findOfGuests([$guest, ...$companions]),
            static fn (SeatAssignment $assignment): array => [$assignment->getGuest()->getId()->toRfc4122(), $assignment],
        ));
        $own = $assignments[$guest->getId()->toRfc4122()] ?? null;

        if (null === $own) {
            return null;
        }

        $elsewhere = [];

        foreach ($companions as $companion) {
            $theirs = $assignments[$companion->getId()->toRfc4122()] ?? null;

            if (null !== $theirs && !$theirs->getPlaceId()->equals($own->getPlaceId())) {
                $elsewhere[] = ['name' => $companion->getFullName(), 'seat' => SeatPlace::of($theirs)];
            }
        }

        return ['seat' => SeatPlace::of($own), 'elsewhere' => $elsewhere];
    }
}
