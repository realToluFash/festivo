<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\SeatingNoteKind;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Two guests the host wants together or apart (sc-1364): one row for the pair, the lower id first, so a note shows on both and one pair holds one note. */
#[ORM\Entity]
#[ORM\Table(name: 'seating_notes')]
#[ORM\UniqueConstraint(name: 'uniq_seating_note_pair', columns: ['guest_id', 'other_guest_id'])]
#[ORM\Index(name: 'idx_seating_note_event', columns: ['event_id'])]
class SeatingNote
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\ManyToOne(targetEntity: Guest::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Guest $guest;

    #[ORM\ManyToOne(targetEntity: Guest::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Guest $otherGuest;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: SeatingNoteKind::class)]
    private SeatingNoteKind $kind;

    public function __construct(Event $event, Guest $one, Guest $other, SeatingNoteKind $kind)
    {
        [$first, $second] = $one->getId()->toRfc4122() < $other->getId()->toRfc4122() ? [$one, $other] : [$other, $one];

        $this->id = Uuid::v7();
        $this->event = $event;
        $this->guest = $first;
        $this->otherGuest = $second;
        $this->kind = $kind;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getGuest(): Guest
    {
        return $this->guest;
    }

    public function getOtherGuest(): Guest
    {
        return $this->otherGuest;
    }

    public function getKind(): SeatingNoteKind
    {
        return $this->kind;
    }

    public function replaceKind(SeatingNoteKind $kind): void
    {
        $this->kind = $kind;
    }
}
