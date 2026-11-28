<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\StationKind;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Where somebody works on an event (sc-3910). A section's row outlives its section, so its people can read that it was removed. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'staff_stations')]
#[ORM\UniqueConstraint(name: 'uniq_staff_station_section', columns: ['section_id'])]
class StaffStation
{
    use Timestampable;

    public const int NAME_MAXIMUM = 60;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: StationKind::class)]
    private StationKind $kind;

    /** A section's is its name when last touched here; the section's own name is read while it exists. */
    #[ORM\Column(type: Types::STRING, length: 240)]
    private string $name;

    #[ORM\Column(type: Types::STRING, length: 240)]
    private string $nameKey;

    #[ORM\ManyToOne(targetEntity: SeatingSection::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?SeatingSection $section;

    #[ORM\ManyToOne(targetEntity: StaffMember::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?StaffMember $lead = null;

    /** The Pass first, then the places in the order they were added. */
    #[ORM\Column(type: Types::INTEGER)]
    private int $position;

    /** Its stop after the Pass while it dishes anything; a place that stops dishing loses it and rejoins at the end. */
    #[ORM\Column(type: Types::INTEGER, nullable: true)]
    private ?int $walkPosition = null;

    public function __construct(Event $event, StationKind $kind, string $name, string $nameKey, ?SeatingSection $section, int $position)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->kind = $kind;
        $this->name = $name;
        $this->nameKey = $nameKey;
        $this->section = $section;
        $this->position = $position;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getKind(): StationKind
    {
        return $this->kind;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name, string $nameKey): void
    {
        $this->name = $name;
        $this->nameKey = $nameKey;
    }

    public function getNameKey(): string
    {
        return $this->nameKey;
    }

    public function getSection(): ?SeatingSection
    {
        return $this->section;
    }

    public function getLead(): ?StaffMember
    {
        return $this->lead;
    }

    public function setLead(?StaffMember $lead): void
    {
        $this->lead = $lead;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function getWalkPosition(): ?int
    {
        return $this->walkPosition;
    }

    public function setWalkPosition(?int $walkPosition): void
    {
        $this->walkPosition = $walkPosition;
    }

    public function isPlace(): bool
    {
        return StationKind::Section !== $this->kind;
    }
}
