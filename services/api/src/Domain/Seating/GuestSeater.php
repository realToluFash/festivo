<?php

declare(strict_types=1);

namespace App\Domain\Seating;

use App\Audit\Auditor;
use App\Domain\Seating\Http\SeatingSerialiser;
use App\Entity\Event;
use App\Entity\Guest;
use App\Entity\SeatAssignment;
use App\Entity\SeatingPlan;
use App\Entity\SeatingRow;
use App\Entity\SeatingSeat;
use App\Entity\SeatingTable;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\GuestReply;
use App\Enum\RealtimeTopic;
use App\Http\Exception\ApiException;
use App\Realtime\CheckInSignal;
use App\Realtime\RealtimePublisher;
use App\Repository\GuestRepository;
use App\Repository\SeatAssignmentRepository;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Dict;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * @phpstan-type Chair array{place: SeatingTable|SeatingRow|SeatingSeat, seat: int}
 * @phpstan-type Move array{guest: Guest, from: ?Chair, to: ?Chair}
 * @phpstan-type ChairRef array{kind: 'table'|'row'|'seat', id: string, seat: int}
 */
final readonly class GuestSeater
{
    public const string MOVED = 'seating.guest_moved';

    public function __construct(
        private SeatAssignmentRepository $seatAssignmentRepository,
        private GuestRepository $guestRepository,
        private SeatingSerialiser $seatingSerialiser,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private RealtimePublisher $realtimePublisher,
        private TranslatorInterface $translator,
        private GuestPageSignal $guestPageSignal,
        private CheckInSignal $checkInSignal,
    ) {
    }

    public function seat(Event $event, SeatingPlan $plan, User $by, Guest $guest, SeatingTable|SeatingRow|SeatingSeat $place, ?int $chair, bool $justGuest): Moved
    {
        return $this->acting($event, $plan, $by, $guest, function () use ($guest, $place, $chair, $justGuest): Moved {
            $this->refuseUnlessWaiting($guest);
            $current = $this->seatAssignmentRepository->findOneOf($guest);

            if (null !== $current && null === $chair && $current->getPlaceId()->equals($place->getId())) {
                return new Moved([], false);
            }

            $party = null === $current && null === $guest->getHost() && !$justGuest ? $this->unseatedCompanions($guest) : [];
            $seats = $this->chairsFor($place, $guest, $chair, $guest, Iter\count($party) + 1);

            $moves = [];
            foreach ([$guest, ...$party] as $index => $one) {
                $moves[] = ['guest' => $one, 'from' => 0 === $index && null !== $current ? self::chairOf($current) : null, 'to' => ['place' => $place, 'seat' => $seats[$index]]];
            }

            return new Moved($moves, !self::together($place, $seats));
        });
    }

    public function swap(Event $event, SeatingPlan $plan, User $by, Guest $guest, Guest $other): Moved
    {
        return $this->acting($event, $plan, $by, $guest, function () use ($guest, $other): Moved {
            $this->refuseUnlessWaiting($guest);
            $theirs = $this->seatAssignmentRepository->findOneOf($other) ?? throw new ApiException(ErrorCode::SeatingSeatTaken, 'seating.seat_taken', parameters: ['{name}' => $this->nameOf($guest)]);
            $mine = $this->seatAssignmentRepository->findOneOf($guest);
            $theirChair = self::chairOf($theirs);

            return new Moved([
                ['guest' => $guest, 'from' => null === $mine ? null : self::chairOf($mine), 'to' => $theirChair],
                ['guest' => $other, 'from' => $theirChair, 'to' => null === $mine ? null : self::chairOf($mine)],
            ], false);
        });
    }

    /** @param list<Guest> $guests */
    public function unseat(Event $event, SeatingPlan $plan, User $by, array $guests, SeatingTable|SeatingRow|SeatingSeat|null $place): Moved
    {
        return $this->acting($event, $plan, $by, $guests[0] ?? null, function () use ($guests, $place): Moved {
            $assignments = null === $place ? $this->seatAssignmentRepository->findOfGuests($guests) : $this->seatAssignmentRepository->findAt($place->getId());

            return new Moved(Vec\map($assignments, static fn (SeatAssignment $at): array => ['guest' => $at->getGuest(), 'from' => self::chairOf($at), 'to' => null]), false);
        });
    }

    public function moveEveryone(Event $event, SeatingPlan $plan, User $by, SeatingTable|SeatingRow|SeatingSeat $from, SeatingTable|SeatingRow|SeatingSeat $to): Moved
    {
        return $this->acting($event, $plan, $by, null, function () use ($from, $to): Moved {
            $there = $this->seatAssignmentRepository->findAt($from->getId());

            if ([] === $there || $from->getId()->equals($to->getId())) {
                return new Moved([], false);
            }

            $first = $there[0]->getGuest();
            $seats = $this->chairsFor($to, null, null, $first, Iter\count($there));

            return new Moved(
                Vec\map_with_key($there, static fn (int $index, SeatAssignment $at): array => ['guest' => $at->getGuest(), 'from' => self::chairOf($at), 'to' => ['place' => $to, 'seat' => $seats[$index]]]),
                !self::together($to, $seats),
            );
        });
    }

    /** @param list<Move> $moves */
    public function undo(Event $event, SeatingPlan $plan, User $by, array $moves): Moved
    {
        return $this->acting($event, $plan, $by, null, function () use ($moves): Moved {
            $guests = Vec\map($moves, static fn (array $move): Guest => $move['guest']);
            $now = Dict\from_entries(Vec\map(
                $this->seatAssignmentRepository->findOfGuests($guests),
                static fn (SeatAssignment $at): array => [$at->getGuest()->getId()->toRfc4122(), self::keyOf(self::chairOf($at))],
            ));
            $moving = Dict\from_keys(Vec\map($guests, static fn (Guest $guest): string => $guest->getId()->toRfc4122()), static fn (): bool => true);

            foreach ($moves as $move) {
                $id = $move['guest']->getId()->toRfc4122();
                $stillThere = ($now[$id] ?? null) === (null === $move['to'] ? null : self::keyOf($move['to']));
                $back = $move['from'];

                if (!$stillThere || (null !== $back && (!self::mayBeSeated($move['guest']) || !$this->chairFree($back['place'], $back['seat'], $moving)))) {
                    throw new ApiException(ErrorCode::SeatingUndoStale, 'seating.undo_stale');
                }
            }

            return new Moved(Vec\map($moves, static fn (array $move): array => ['guest' => $move['guest'], 'from' => $move['to'], 'to' => $move['from']]), false);
        });
    }

    public static function mayBeSeated(Guest $guest): bool
    {
        if (null !== $guest->getRemovedAt()) {
            return false;
        }

        $host = $guest->getHost();

        if (null !== $host) {
            return !$guest->isNotComingByGuest() && self::mayBeSeated($host);
        }

        return GuestReply::NotComing !== $guest->getReply();
    }

    public function nameOf(Guest $guest): string
    {
        return $guest->getFullName() ?? $this->translator->trans('seating.companion_of', ['{name}' => $guest->getHost()?->getFullName() ?? '']);
    }

    /** @return ChairRef */
    public static function refOf(SeatingTable|SeatingRow|SeatingSeat $place, int $seat): array
    {
        return ['kind' => self::kindOf($place), 'id' => $place->getId()->toRfc4122(), 'seat' => $seat];
    }

    /** @return 'table'|'row'|'seat' */
    public static function kindOf(SeatingTable|SeatingRow|SeatingSeat $place): string
    {
        return match (true) {
            $place instanceof SeatingTable => 'table',
            $place instanceof SeatingRow => 'row',
            default => 'seat',
        };
    }

    /** @return list<int> */
    public static function usableChairs(SeatingTable|SeatingRow|SeatingSeat $place): array
    {
        if ($place instanceof SeatingSeat) {
            return $place->isUnusable() ? [] : [1];
        }

        $unusable = $place->getUnusableSeats();

        return Vec\filter(Vec\range(1, $place->getSeats()), static fn (int $seat): bool => !Iter\contains($unusable, $seat));
    }

    /** @param callable(): Moved $plan */
    private function acting(Event $event, SeatingPlan $seatingPlan, User $by, ?Guest $named, callable $plan): Moved
    {
        try {
            $done = $this->entityManager->wrapInTransaction(function () use ($seatingPlan, $by, $plan): Moved {
                $this->entityManager->refresh($seatingPlan, LockMode::PESSIMISTIC_WRITE);
                $done = $plan();
                $this->settle($done->moves, $by);

                return $done;
            });
        } catch (UniqueConstraintViolationException $taken) {
            throw new ApiException(ErrorCode::SeatingSeatTaken, 'seating.seat_taken', previous: $taken, parameters: ['{name}' => null === $named ? '' : $this->nameOf($named)]);
        }

        $this->checkInSignal->send($event);
        $this->realtimePublisher->publish(RealtimeTopic::EventSeating, $event->getId()->toRfc4122(), $this->seatingSerialiser->seating($event, $seatingPlan));
        $this->guestPageSignal->seatingChanged($event);

        return $done;
    }

    /** @param list<Move> $moves leave their chairs and flush first, so a swap or a party never meets itself in a key */
    private function settle(array $moves, User $by): void
    {
        $leaving = $this->seatAssignmentRepository->findOfGuests(Vec\map($moves, static fn (array $move): Guest => $move['guest']));

        foreach ($leaving as $assignment) {
            $this->entityManager->remove($assignment);
        }

        $this->entityManager->flush();

        foreach ($moves as $move) {
            if (null !== $move['to']) {
                $this->entityManager->persist(new SeatAssignment($move['guest'], $move['to']['place'], $move['to']['seat']));
            }

            $this->auditor->record(self::MOVED, 'Guest', $move['guest']->getId(), Actor::User, $by->getId(), $by->getName(), Auditor::diff(
                ['seat' => null === $move['from'] ? null : self::described($move['from'])],
                ['seat' => null === $move['to'] ? null : self::described($move['to'])],
            ));
        }

        $this->entityManager->flush();
    }

    private function refuseUnlessWaiting(Guest $guest): void
    {
        if (!self::mayBeSeated($guest)) {
            throw new ApiException(ErrorCode::SeatingGuestNotWaiting, 'seating.guest_not_waiting', parameters: ['{name}' => $this->nameOf($guest)]);
        }
    }

    /** @return list<Guest> */
    private function unseatedCompanions(Guest $lead): array
    {
        $companions = Vec\filter($this->guestRepository->findCompanionsOf($lead), self::mayBeSeated(...));
        $seated = Dict\from_entries(Vec\map(
            $this->seatAssignmentRepository->findOfGuests($companions),
            static fn (SeatAssignment $at): array => [$at->getGuest()->getId()->toRfc4122(), true],
        ));

        return Vec\filter($companions, static fn (Guest $one): bool => !Iter\contains_key($seated, $one->getId()->toRfc4122()));
    }

    /** @return array<int, Guest> by seat number, `$leaving`'s chair counted free */
    private function takenAt(SeatingTable|SeatingRow|SeatingSeat $place, ?Guest $leaving): array
    {
        $taken = [];

        foreach ($this->seatAssignmentRepository->findAt($place->getId()) as $at) {
            if (true !== $leaving?->getId()->equals($at->getGuest()->getId())) {
                $taken[$at->getSeat()] = $at->getGuest();
            }
        }

        return $taken;
    }

    /** @return list<int> from `$chair` on, else the first run of neighbouring free chairs clockwise from the top, else the first free ones */
    private function chairsFor(SeatingTable|SeatingRow|SeatingSeat $place, ?Guest $leaving, ?int $chair, Guest $lead, int $count): array
    {
        $taken = $this->takenAt($place, $leaving);
        $usable = self::usableChairs($place);
        $free = Vec\filter($usable, static fn (int $seat): bool => !Iter\contains_key($taken, $seat));
        $name = self::placeName($place);

        if (null !== $chair) {
            if (!Iter\contains($usable, $chair)) {
                throw ApiException::validation([[
                    'propertyPath' => 'seat',
                    'message' => $this->translator->trans('validation.seating_no_such_chair', ['{name}' => $name]),
                    'code' => ErrorCode::ValidationFailed->value,
                ]]);
            }

            if (Iter\contains_key($taken, $chair)) {
                throw new ApiException(ErrorCode::SeatingSeatTaken, 'seating.seat_taken', members: ['takenBy' => $taken[$chair]->getId()->toRfc4122()], parameters: ['{name}' => $this->nameOf($lead)]);
            }

            $after = Vec\filter($free, static fn (int $seat): bool => $seat >= $chair);
            $free = $place instanceof SeatingTable ? [...$after, ...Vec\filter($free, static fn (int $seat): bool => $seat < $chair)] : $after;
        }

        if ([] === $free) {
            throw new ApiException(ErrorCode::SeatingTableFull, 'seating.table_full', parameters: ['{table}' => $name]);
        }

        if (Iter\count($free) < $count) {
            throw new ApiException(
                ErrorCode::SeatingTableShort,
                'seating.table_short',
                members: ['free' => Iter\count($free), 'party' => $count],
                parameters: ['{table}' => $name, '{free}' => Iter\count($free), '{name}' => $this->nameOf($lead), '{party}' => $count],
            );
        }

        if (null !== $chair) {
            return Vec\take($free, Type\uint()->coerce($count));
        }

        $all = $place instanceof SeatingSeat ? 1 : $place->getSeats();
        $ring = $place instanceof SeatingTable;

        foreach (Vec\range(1, $all) as $start) {
            $run = Vec\map(Vec\range(0, $count - 1), static fn (int $step): int => $ring ? (($start - 1 + $step) % $all) + 1 : $start + $step);

            if (Iter\all($run, static fn (int $seat): bool => Iter\contains($free, $seat))) {
                return $run;
            }
        }

        return Vec\take($free, Type\uint()->coerce($count));
    }

    /** @param list<int> $seats */
    private static function together(SeatingTable|SeatingRow|SeatingSeat $place, array $seats): bool
    {
        if (Iter\count($seats) < 2) {
            return true;
        }

        $all = $place instanceof SeatingSeat ? 1 : $place->getSeats();
        $ring = $place instanceof SeatingTable;

        foreach (Vec\range(1, Iter\count($seats) - 1) as $index) {
            $next = $seats[$index - 1] + 1;
            $next = $ring && $next > $all ? 1 : $next;

            if ($seats[$index] !== $next) {
                return false;
            }
        }

        return true;
    }

    /** @param array<string, bool> $moving guests whose own chairs are given up in the same step */
    private function chairFree(SeatingTable|SeatingRow|SeatingSeat $place, int $seat, array $moving): bool
    {
        if (!Iter\contains(self::usableChairs($place), $seat)) {
            return false;
        }

        foreach ($this->seatAssignmentRepository->findAt($place->getId()) as $at) {
            if ($at->getSeat() === $seat && !Iter\contains_key($moving, $at->getGuest()->getId()->toRfc4122())) {
                return false;
            }
        }

        return true;
    }

    /** @return Chair */
    private static function chairOf(SeatAssignment $at): array
    {
        return ['place' => $at->getPlace(), 'seat' => $at->getSeat()];
    }

    /** @param Chair $chair */
    private static function keyOf(array $chair): string
    {
        return $chair['place']->getId()->toRfc4122() . '#' . $chair['seat'];
    }

    /** @param Chair $chair */
    private static function described(array $chair): string
    {
        return self::placeName($chair['place']) . ' #' . $chair['seat'];
    }

    public static function placeName(SeatingTable|SeatingRow|SeatingSeat $place): string
    {
        return $place instanceof SeatingRow ? $place->getLabel() : $place->getName();
    }

    public function placeIn(SeatingPlan $plan, string $kind, string $id): SeatingTable|SeatingRow|SeatingSeat
    {
        $class = match ($kind) {
            'table' => SeatingTable::class,
            'row' => SeatingRow::class,
            default => SeatingSeat::class,
        };
        $place = Uuid::isValid($id) ? $this->entityManager->find($class, Uuid::fromString($id)) : null;

        if (!$place instanceof SeatingTable && !$place instanceof SeatingRow && !$place instanceof SeatingSeat || !$place->getPlan()->getId()->equals($plan->getId())) {
            throw ApiException::notFound('seating.no_such_item');
        }

        return $place;
    }
}
