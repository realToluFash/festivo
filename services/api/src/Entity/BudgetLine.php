<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\CostBasis;
use App\Enum\CostCategory;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/** The price is in the event's currency, which cannot change while a line exists; the migration's CHECKs keep it off a staff-time line and on every other. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'budget_lines')]
#[ORM\Index(name: 'idx_budget_line_event', columns: ['event_id'])]
#[ORM\UniqueConstraint(name: 'uniq_budget_staff_line', columns: ['event_id'], options: ['where' => "(((basis)::text = 'per_staff_hour'::text) AND (removed_at IS NULL))"])]
class BudgetLine
{
    use Timestampable;

    public const int LABEL_MAXIMUM = 100;

    public const int NOTE_MAXIMUM = 500;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    /** Null only once a currency change has erased the removed line. */
    #[ORM\Column(type: Types::STRING, length: 400, nullable: true)]
    private ?string $label;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: CostCategory::class)]
    private CostCategory $category;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: CostBasis::class)]
    private CostBasis $basis;

    /** In the currency's minor unit: the rate on a per-something line, the amount on a fixed one, null on a staff-time line. */
    #[ORM\Column(type: Types::BIGINT, nullable: true)]
    private ?string $priceMinor;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $note;

    /** Removed and waiting for its Undo (sc-85, decided 19 Nov): in no figure and no read, until BudgetEditor erases it a day after. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $removedAt = null;

    /** Removed before the event's currency changed: Undo can no longer put it back, and its words and price are erased (sc-85, decided 19 Nov, #72668, #72947). */
    #[ORM\Column(options: ['default' => false])]
    private bool $currencyChanged = false;

    public function __construct(Event $event, string $label, CostCategory $category, CostBasis $basis, ?int $priceMinor, ?string $note)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->label = $label;
        $this->category = $category;
        $this->basis = $basis;
        $this->priceMinor = null === $priceMinor ? null : (string) $priceMinor;
        $this->note = $note;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getLabel(): string
    {
        return Type\string()->assert($this->label);
    }

    public function setLabel(string $label): void
    {
        $this->label = $label;
    }

    public function getCategory(): CostCategory
    {
        return $this->category;
    }

    public function setCategory(CostCategory $category): void
    {
        $this->category = $category;
    }

    public function getBasis(): CostBasis
    {
        return $this->basis;
    }

    public function setBasis(CostBasis $basis): void
    {
        $this->basis = $basis;
    }

    public function getPriceMinor(): ?int
    {
        return null === $this->priceMinor ? null : (int) $this->priceMinor;
    }

    public function setPriceMinor(?int $priceMinor): void
    {
        $this->priceMinor = null === $priceMinor ? null : (string) $priceMinor;
    }

    public function getNote(): ?string
    {
        return $this->note;
    }

    public function setNote(?string $note): void
    {
        $this->note = $note;
    }

    public function isRemoved(): bool
    {
        return null !== $this->removedAt;
    }

    public function getRemovedAt(): ?DateTimeImmutable
    {
        return $this->removedAt;
    }

    public function remove(DateTimeImmutable $at): void
    {
        $this->removedAt = $at;
    }

    public function putBack(): void
    {
        $this->removedAt = null;
    }

    public function isCurrencyChanged(): bool
    {
        return $this->currencyChanged;
    }
}
