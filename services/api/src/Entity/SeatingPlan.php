<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** An event's one room, measured in centimetres (sc-3998). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'seating_plans')]
class SeatingPlan
{
    use Timestampable;

    public const int ROOM_NAME_MAXIMUM = 60;

    public const int SIDE_MINIMUM_CM = 200;

    public const int SIDE_MAXIMUM_CM = 50_000;

    public const int SECTIONS_MAXIMUM = 30;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\OneToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, unique: true, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\Column(type: Types::STRING, length: 60, nullable: true)]
    private ?string $roomName;

    #[ORM\Column(type: Types::INTEGER)]
    private int $widthCm;

    #[ORM\Column(type: Types::INTEGER)]
    private int $lengthCm;

    /** Who last changed the room or one of its sections, named in a colleague's refused save. */
    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $changedBy;

    /** Moved by Doctrine on every update; the room's ETag. */
    #[ORM\Version]
    #[ORM\Column(type: Types::INTEGER, options: ['default' => 1])]
    private int $version = 1;

    public function __construct(Event $event, ?string $roomName, int $widthCm, int $lengthCm, ?User $changedBy)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->roomName = $roomName;
        $this->widthCm = $widthCm;
        $this->lengthCm = $lengthCm;
        $this->changedBy = $changedBy;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getRoomName(): ?string
    {
        return $this->roomName;
    }

    public function setRoomName(?string $roomName): void
    {
        $this->roomName = $roomName;
    }

    public function getWidthCm(): int
    {
        return $this->widthCm;
    }

    public function setWidthCm(int $widthCm): void
    {
        $this->widthCm = $widthCm;
    }

    public function getLengthCm(): int
    {
        return $this->lengthCm;
    }

    public function setLengthCm(int $lengthCm): void
    {
        $this->lengthCm = $lengthCm;
    }

    public function getChangedBy(): ?User
    {
        return $this->changedBy;
    }

    public function setChangedBy(?User $changedBy): void
    {
        $this->changedBy = $changedBy;
    }

    public function getVersion(): int
    {
        return $this->version;
    }
}
