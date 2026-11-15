<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\SectionColour;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A name and a colour that tables, rows and single seats carry as a label; it has no area of its own (sc-3998). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'seating_sections')]
#[ORM\UniqueConstraint(name: 'uniq_seating_section_name', columns: ['plan_id', 'name_key'])]
class SeatingSection
{
    use Timestampable;

    public const int NAME_MAXIMUM = 40;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: SeatingPlan::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private SeatingPlan $plan;

    #[ORM\Column(type: Types::STRING, length: 40)]
    private string $name;

    /** The name without case or accents, so "Terrasse" and "terrassé" are one section. */
    #[ORM\Column(type: Types::STRING, length: 160)]
    private string $nameKey;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: SectionColour::class)]
    private SectionColour $colour;

    /** Who last changed it, named in a colleague's refused save. */
    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $changedBy;

    /** Moved by Doctrine on every update; the section's ETag. */
    #[ORM\Version]
    #[ORM\Column(type: Types::INTEGER, options: ['default' => 1])]
    private int $version = 1;

    public function __construct(SeatingPlan $plan, string $name, string $nameKey, SectionColour $colour, ?User $changedBy)
    {
        $this->id = Uuid::v7();
        $this->plan = $plan;
        $this->name = $name;
        $this->nameKey = $nameKey;
        $this->colour = $colour;
        $this->changedBy = $changedBy;
    }

    public function getChangedBy(): ?User
    {
        return $this->changedBy;
    }

    public function setChangedBy(?User $changedBy): void
    {
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

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getNameKey(): string
    {
        return $this->nameKey;
    }

    public function setNameKey(string $nameKey): void
    {
        $this->nameKey = $nameKey;
    }

    public function getColour(): SectionColour
    {
        return $this->colour;
    }

    public function setColour(SectionColour $colour): void
    {
        $this->colour = $colour;
    }

    public function getVersion(): int
    {
        return $this->version;
    }
}
