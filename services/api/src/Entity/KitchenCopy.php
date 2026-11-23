<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A kitchen sheet given to the kitchen (sc-30812): the whole sheet as it was, names included; who reads them is decided on every read, and an erased guest's row leaves `sheet`. */
#[ORM\Entity(readOnly: true)]
#[ORM\Table(name: 'kitchen_copies')]
#[ORM\Index(name: 'idx_kitchen_copy_event', columns: ['event_id', 'recorded_at'])]
class KitchenCopy
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $recordedAt;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $recordedBy;

    #[ORM\Column(type: Types::STRING, length: 720)]
    private string $recordedByName;

    /** Whether the member who recorded it held guests.manage then: the names reach a reader only when both did. */
    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $names;

    /** @var array<string, mixed> */
    #[ORM\Column(type: Types::JSON, options: ['jsonb' => true])]
    private array $sheet;

    /** @param array<string, mixed> $sheet */
    public function __construct(Event $event, DateTimeImmutable $recordedAt, User $recordedBy, bool $names, array $sheet)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->recordedAt = $recordedAt->setTimezone(new DateTimeZone('UTC'));
        $this->recordedBy = $recordedBy;
        $this->recordedByName = $recordedBy->getName();
        $this->names = $names;
        $this->sheet = $sheet;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getRecordedAt(): DateTimeImmutable
    {
        return $this->recordedAt;
    }

    public function getRecordedByName(): string
    {
        return $this->recordedByName;
    }

    public function heldNames(): bool
    {
        return $this->names;
    }

    /** @return array<string, mixed> */
    public function getSheet(): array
    {
        return $this->sheet;
    }
}
