<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\CostCategory;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A markup set once for an event's budget, or for one category of it (sc-92); a line's own markup or price overrides both. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'budget_markups')]
#[ORM\Index(name: 'idx_budget_markup_event', columns: ['event_id'])]
#[ORM\UniqueConstraint(name: 'uniq_budget_markup_event', columns: ['event_id'], options: ['where' => '(category IS NULL)'])]
#[ORM\UniqueConstraint(name: 'uniq_budget_markup_category', columns: ['event_id', 'category'], options: ['where' => '(category IS NOT NULL)'])]
class BudgetMarkup
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    /** Null for the whole event. */
    #[ORM\Column(type: Types::STRING, length: 16, nullable: true, enumType: CostCategory::class)]
    private ?CostCategory $category;

    /** Tenths of a percent of cost, 0 being at cost by choice. */
    #[ORM\Column(type: Types::INTEGER)]
    private int $markupTenths;

    public function __construct(Event $event, ?CostCategory $category, int $markupTenths)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->category = $category;
        $this->markupTenths = $markupTenths;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getCategory(): ?CostCategory
    {
        return $this->category;
    }

    public function getMarkupTenths(): int
    {
        return $this->markupTenths;
    }

    public function setMarkupTenths(int $markupTenths): void
    {
        $this->markupTenths = $markupTenths;
    }
}
