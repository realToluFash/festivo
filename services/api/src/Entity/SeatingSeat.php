<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A single seat that belongs to no table (sc-4003): a row of one with a name and no number, "By the door". */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'seating_seats')]
#[ORM\UniqueConstraint(name: 'uniq_seating_seat_name', columns: ['plan_id', 'name_key'])]
class SeatingSeat
{
    use Timestampable;

    public const int NAME_MAXIMUM = 30;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: SeatingPlan::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private SeatingPlan $plan;

    #[ORM\ManyToOne(targetEntity: SeatingSection::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?SeatingSection $section;

    /** Stored as typed, in the creator's language, so everyone sees it as written. */
    #[ORM\Column(type: Types::STRING, length: 30)]
    private string $name;

    /** The name without case or accents, so "By the door" and "by the door" are one seat. */
    #[ORM\Column(type: Types::STRING, length: 120)]
    private string $nameKey;

    /** The seat's centre from the room's top left corner. */
    #[ORM\Column(type: Types::INTEGER)]
    private int $xCm;

    #[ORM\Column(type: Types::INTEGER)]
    private int $yCm;

    #[ORM\Column(type: Types::BOOLEAN, options: ['default' => false])]
    private bool $unusable = false;

    /** Who last changed it, named in a colleague's refused save. */
    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $changedBy;

    /** Moved by Doctrine on every update; the seat's ETag. */
    #[ORM\Version]
    #[ORM\Column(type: Types::INTEGER, options: ['default' => 1])]
    private int $version = 1;

    public function __construct(SeatingPlan $plan, string $name, string $nameKey, int $xCm, int $yCm, ?User $changedBy)
    {
        $this->id = Uuid::v7();
        $this->plan = $plan;
        $this->section = null;
        $this->name = $name;
        $this->nameKey = $nameKey;
        $this->xCm = $xCm;
        $this->yCm = $yCm;
        $this->changedBy = $changedBy;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getPlan(): SeatingPlan
    {
        return $this->plan;
    }

    public function getSection(): ?SeatingSection
    {
        return $this->section;
    }

    public function setSection(?SeatingSection $section): void
    {
        $this->section = $section;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getNameKey(): string
    {
        return $this->nameKey;
    }

    public function rename(string $name, string $nameKey): void
    {
        $this->name = $name;
        $this->nameKey = $nameKey;
    }

    public function getXCm(): int
    {
        return $this->xCm;
    }

    public function getYCm(): int
    {
        return $this->yCm;
    }

    public function moveTo(int $xCm, int $yCm): void
    {
        $this->xCm = $xCm;
        $this->yCm = $yCm;
    }

    public function isUnusable(): bool
    {
        return $this->unusable;
    }

    public function setUnusable(bool $unusable): void
    {
        $this->unusable = $unusable;
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
