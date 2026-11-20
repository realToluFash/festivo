<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A straight line of numbered seats (sc-4003): seat 1 on the left of a guest sitting in it and facing the front, the number staying with the seat as the row turns. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'seating_rows')]
#[ORM\UniqueConstraint(name: 'uniq_seating_row_label', columns: ['plan_id', 'label_key'])]
class SeatingRow
{
    use Timestampable;

    public const int LABEL_MAXIMUM = 10;

    public const int SEATS_MINIMUM = 1;

    public const int SEATS_MAXIMUM = 60;

    public const int SEATS_DEFAULT = 10;

    public const int SPACING_MINIMUM_CM = 40;

    public const int SPACING_MAXIMUM_CM = 100;

    public const int SPACING_DEFAULT_CM = 50;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: SeatingPlan::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private SeatingPlan $plan;

    #[ORM\ManyToOne(targetEntity: SeatingSection::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?SeatingSection $section;

    #[ORM\Column(type: Types::STRING, length: 40)]
    private string $label;

    /** The label without case or accents, so "a" and "A" are one row. */
    #[ORM\Column(type: Types::STRING, length: 40)]
    private string $labelKey;

    #[ORM\Column(type: Types::SMALLINT)]
    private int $seats;

    /** Centre to centre. */
    #[ORM\Column(type: Types::SMALLINT)]
    private int $spacingCm;

    /** Degrees clockwise, in 15° steps. */
    #[ORM\Column(type: Types::SMALLINT)]
    private int $rotation;

    /** The row's centre from the room's top left corner. */
    #[ORM\Column(type: Types::INTEGER)]
    private int $xCm;

    #[ORM\Column(type: Types::INTEGER)]
    private int $yCm;

    /** @var list<int> seat numbers, from 1 */
    #[ORM\Column(type: Types::JSON, options: ['default' => '[]'])]
    private array $unusableSeats = [];

    /** Who last changed it, named in a colleague's refused save. */
    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $changedBy;

    /** Moved by Doctrine on every update; the row's ETag. */
    #[ORM\Version]
    #[ORM\Column(type: Types::INTEGER, options: ['default' => 1])]
    private int $version = 1;

    public function __construct(SeatingPlan $plan, string $label, string $labelKey, int $xCm, int $yCm, ?User $changedBy)
    {
        $this->id = Uuid::v7();
        $this->plan = $plan;
        $this->section = null;
        $this->label = $label;
        $this->labelKey = $labelKey;
        $this->seats = self::SEATS_DEFAULT;
        $this->spacingCm = self::SPACING_DEFAULT_CM;
        $this->rotation = 0;
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

    public function getLabel(): string
    {
        return $this->label;
    }

    public function getLabelKey(): string
    {
        return $this->labelKey;
    }

    public function relabel(string $label, string $labelKey): void
    {
        $this->label = $label;
        $this->labelKey = $labelKey;
    }

    public function getSeats(): int
    {
        return $this->seats;
    }

    public function getSpacingCm(): int
    {
        return $this->spacingCm;
    }

    public function getRotation(): int
    {
        return $this->rotation;
    }

    /** @param list<int> $unusableSeats */
    public function lay(int $seats, int $spacingCm, int $rotation, array $unusableSeats): void
    {
        $this->seats = $seats;
        $this->spacingCm = $spacingCm;
        $this->rotation = $rotation;
        $this->unusableSeats = $unusableSeats;
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

    /** @return list<int> */
    public function getUnusableSeats(): array
    {
        return $this->unusableSeats;
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
