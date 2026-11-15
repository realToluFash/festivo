<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\TableShape;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A table in the room (sc-4000): shape, size and seats live here, never inferred from the seat count; a round table's diameter is its width and length. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'seating_tables')]
#[ORM\UniqueConstraint(name: 'uniq_seating_table_name', columns: ['plan_id', 'name_key'])]
class SeatingTable
{
    use Timestampable;

    public const int NAME_MAXIMUM = 30;

    public const int SEATS_MINIMUM = 1;

    public const int SEATS_MAXIMUM = 30;

    public const int SIZE_MINIMUM_CM = 40;

    public const int SIZE_MAXIMUM_CM = 1000;

    public const int ROTATION_STEP = 15;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: SeatingPlan::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private SeatingPlan $plan;

    #[ORM\ManyToOne(targetEntity: SeatingSection::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?SeatingSection $section;

    #[ORM\Column(type: Types::STRING, length: 30)]
    private string $name;

    /** The name without case or accents, so "Table 1" and "table 1" are one table. */
    #[ORM\Column(type: Types::STRING, length: 120)]
    private string $nameKey;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: TableShape::class)]
    private TableShape $shape;

    #[ORM\Column(type: Types::SMALLINT)]
    private int $seats;

    #[ORM\Column(type: Types::INTEGER)]
    private int $widthCm;

    #[ORM\Column(type: Types::INTEGER)]
    private int $lengthCm;

    /** Split between the two ends, the left taking the odd one; always 0 on a round or cocktail table. */
    #[ORM\Column(type: Types::SMALLINT)]
    private int $endSeats;

    /** Degrees clockwise, in 15° steps; always 0 on a round or cocktail table. */
    #[ORM\Column(type: Types::SMALLINT)]
    private int $rotation;

    /** The table's centre from the room's top left corner. */
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

    /** Moved by Doctrine on every update; the table's ETag. */
    #[ORM\Version]
    #[ORM\Column(type: Types::INTEGER, options: ['default' => 1])]
    private int $version = 1;

    public function __construct(SeatingPlan $plan, string $name, string $nameKey, TableShape $shape, int $xCm, int $yCm, ?User $changedBy)
    {
        $defaults = $shape->defaults();
        $this->id = Uuid::v7();
        $this->plan = $plan;
        $this->section = null;
        $this->name = $name;
        $this->nameKey = $nameKey;
        $this->shape = $shape;
        $this->seats = $defaults['seats'];
        $this->widthCm = $defaults['widthCm'];
        $this->lengthCm = $defaults['lengthCm'];
        $this->endSeats = 0;
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

    public function getShape(): TableShape
    {
        return $this->shape;
    }

    public function getSeats(): int
    {
        return $this->seats;
    }

    public function getWidthCm(): int
    {
        return $this->widthCm;
    }

    public function getLengthCm(): int
    {
        return $this->lengthCm;
    }

    public function getEndSeats(): int
    {
        return $this->endSeats;
    }

    public function getRotation(): int
    {
        return $this->rotation;
    }

    /** @param list<int> $unusableSeats */
    public function lay(TableShape $shape, int $seats, int $widthCm, int $lengthCm, int $endSeats, int $rotation, array $unusableSeats): void
    {
        $this->shape = $shape;
        $this->seats = $seats;
        $this->widthCm = $widthCm;
        $this->lengthCm = $lengthCm;
        $this->endSeats = $endSeats;
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
