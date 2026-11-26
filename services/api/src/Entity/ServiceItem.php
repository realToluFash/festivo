<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Type\MillisecondDateTimeType;
use App\Enum\ItemState;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One course item's state at its station, the same for every plate that has it (sc-4005). An item with no row is Ready. */
#[ORM\Entity]
#[ORM\Table(name: 'service_items')]
#[ORM\UniqueConstraint(name: 'uniq_service_item', columns: ['course_id', 'item_key'])]
class ServiceItem
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\ManyToOne(targetEntity: MenuCourse::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private MenuCourse $course;

    /** NameNormaliser::key of the item, as sc-34230 tells one item from another. */
    #[ORM\Column(type: Types::STRING, length: 240)]
    private string $itemKey;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: ItemState::class)]
    private ItemState $state = ItemState::Ready;

    #[ORM\Column(type: Types::SMALLINT, nullable: true)]
    private ?int $readyIn = null;

    #[ORM\Column(type: MillisecondDateTimeType::NAME, nullable: true)]
    private ?DateTimeImmutable $changedAt = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $changedBy = null;

    public function __construct(MenuCourse $course, string $itemKey)
    {
        $this->id = Uuid::v7();
        $this->event = $course->getEvent();
        $this->course = $course;
        $this->itemKey = $itemKey;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getCourse(): MenuCourse
    {
        return $this->course;
    }

    public function getItemKey(): string
    {
        return $this->itemKey;
    }

    public function getState(): ItemState
    {
        return $this->state;
    }

    public function getReadyIn(): ?int
    {
        return $this->readyIn;
    }

    public function getChangedAt(): ?DateTimeImmutable
    {
        return $this->changedAt;
    }

    public function getChangedBy(): ?User
    {
        return $this->changedBy;
    }

    public function mark(ItemState $state, ?int $readyIn, DateTimeImmutable $at, User $by): void
    {
        $this->state = $state;
        $this->readyIn = ItemState::Preparing === $state ? $readyIn : null;
        $this->changedAt = $at;
        $this->changedBy = $by;
    }

    /** @return array{state: string, readyIn: ?int, changedAt: ?string, changedBy: ?string} what undo puts back */
    public function snapshot(): array
    {
        return ['state' => $this->state->value, 'readyIn' => $this->readyIn, 'changedAt' => $this->changedAt?->format(\DATE_RFC3339_EXTENDED), 'changedBy' => $this->changedBy?->getId()->toRfc4122()];
    }

    /** @param array{state: string, readyIn: ?int, changedAt: ?string, changedBy: ?string} $snapshot */
    public function restore(array $snapshot, ?User $changedBy): void
    {
        $this->state = ItemState::from($snapshot['state']);
        $this->readyIn = $snapshot['readyIn'];
        $this->changedAt = null === $snapshot['changedAt'] ? null : new DateTimeImmutable($snapshot['changedAt']);
        $this->changedBy = $changedBy;
    }
}
