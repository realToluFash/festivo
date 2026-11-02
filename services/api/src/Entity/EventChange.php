<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\EventChangeKind;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One thing somebody did to an event that its other members hear of (sc-13214), written through EventChangeRecorder. A null actor name is Soirely support. */
#[ORM\Entity(readOnly: true)]
#[ORM\Table(name: 'event_changes')]
#[ORM\Index(name: 'idx_event_change_event', columns: ['event_id', 'id'])]
class EventChange
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $actor;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $actorName;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: EventChangeKind::class)]
    private EventChangeKind $kind;

    /** @var array<string, array{0: mixed, 1: mixed}> each field it moved, before and after */
    #[ORM\Column(type: Types::JSON, options: ['jsonb' => true])]
    private array $fields;

    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $eventDay;

    /** A deletion's: until when support can restore the event (sc-3592). */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $restorableUntil;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    /** @param array<string, array{0: mixed, 1: mixed}> $fields */
    public function __construct(Uuid $id, Event $event, ?User $actor, ?string $actorName, EventChangeKind $kind, array $fields, bool $eventDay, ?DateTimeImmutable $restorableUntil, DateTimeImmutable $createdAt)
    {
        $this->id = $id;
        $this->event = $event;
        $this->actor = $actor;
        $this->actorName = $actorName;
        $this->kind = $kind;
        $this->fields = $fields;
        $this->eventDay = $eventDay;
        $this->restorableUntil = $restorableUntil;
        $this->createdAt = $createdAt;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getActor(): ?User
    {
        return $this->actor;
    }

    public function getActorName(): ?string
    {
        return $this->actorName;
    }

    public function getKind(): EventChangeKind
    {
        return $this->kind;
    }

    /** @return array<string, array{0: mixed, 1: mixed}> */
    public function getFields(): array
    {
        return $this->fields;
    }

    public function isEventDay(): bool
    {
        return $this->eventDay;
    }

    public function getRestorableUntil(): ?DateTimeImmutable
    {
        return $this->restorableUntil;
    }

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }
}
