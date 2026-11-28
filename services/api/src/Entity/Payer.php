<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Somebody covering some of an event's costs (sc-91): a name and a note, and no contact, account or language. Removed and kept a day for its Undo, as a budget line is. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'payers')]
#[ORM\Index(name: 'idx_payer_event', columns: ['event_id'])]
class Payer
{
    use Timestampable;

    public const int NAME_MAXIMUM = 60;

    public const int NOTE_MAXIMUM = 200;

    public const int PER_EVENT = 20;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\Column(type: Types::STRING, length: 240)]
    private string $name;

    #[ORM\Column(type: Types::STRING, length: 800, nullable: true)]
    private ?string $note;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $removedAt = null;

    public function __construct(Event $event, string $name, ?string $note)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->name = $name;
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

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getNote(): ?string
    {
        return $this->note;
    }

    public function setNote(?string $note): void
    {
        $this->note = $note;
    }

    public function getRemovedAt(): ?DateTimeImmutable
    {
        return $this->removedAt;
    }

    public function setRemovedAt(?DateTimeImmutable $removedAt): void
    {
        $this->removedAt = $removedAt;
    }

    public function isRemoved(): bool
    {
        return null !== $this->removedAt;
    }
}
