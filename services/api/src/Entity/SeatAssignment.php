<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use LogicException;
use Symfony\Component\Uid\Uuid;

/** A guest in a chair (sc-4013), deleted rather than soft-deleted when they leave it, so an empty chair is never refused as taken. */
#[ORM\Entity]
#[ORM\Table(name: 'seat_assignments')]
#[ORM\UniqueConstraint(name: 'uniq_seat_assignment_guest', columns: ['event_id', 'guest_id'])]
#[ORM\UniqueConstraint(name: 'uniq_seat_assignment_chair', columns: ['event_id', 'place_id', 'seat'])]
class SeatAssignment
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\ManyToOne(targetEntity: SeatingPlan::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private SeatingPlan $plan;

    #[ORM\ManyToOne(targetEntity: Guest::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Guest $guest;

    #[ORM\ManyToOne(targetEntity: SeatingTable::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?SeatingTable $table;

    #[ORM\ManyToOne(targetEntity: SeatingRow::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?SeatingRow $row;

    #[ORM\ManyToOne(targetEntity: SeatingSeat::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?SeatingSeat $singleSeat;

    /** The table's, row's or single seat's id, so one key covers a chair whatever its place. */
    #[ORM\Column(type: 'uuid')]
    private Uuid $placeId;

    /** From 1, clockwise from the top at a table and from seat 1 in a row; always 1 at a single seat. */
    #[ORM\Column(type: Types::SMALLINT)]
    private int $seat;

    public function __construct(Guest $guest, SeatingTable|SeatingRow|SeatingSeat $place, int $seat)
    {
        $this->id = Uuid::v7();
        $this->event = $guest->getEvent();
        $this->plan = $place->getPlan();
        $this->guest = $guest;
        $this->table = $place instanceof SeatingTable ? $place : null;
        $this->row = $place instanceof SeatingRow ? $place : null;
        $this->singleSeat = $place instanceof SeatingSeat ? $place : null;
        $this->placeId = $place->getId();
        $this->seat = $seat;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getGuest(): Guest
    {
        return $this->guest;
    }

    public function getPlace(): SeatingTable|SeatingRow|SeatingSeat
    {
        return $this->table ?? $this->row ?? $this->singleSeat ?? throw new LogicException('A seat assignment has a place.');
    }

    public function getPlaceId(): Uuid
    {
        return $this->placeId;
    }

    public function getSeat(): int
    {
        return $this->seat;
    }

    public function renumber(int $seat): void
    {
        $this->seat = $seat;
    }
}
