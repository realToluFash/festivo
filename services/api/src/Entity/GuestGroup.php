<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One part of an event's list, Bride's side or Work (sc-3775): a guest is in one at most, and their companions with them. A deleted one keeps its row, so a condition on it can still name it (sc-3957). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'guest_groups')]
#[ORM\UniqueConstraint(name: 'uniq_guest_group_name', columns: ['event_id', 'name_key'], options: ['where' => '(deleted_at IS NULL)'])]
class GuestGroup
{
    use Timestampable;

    public const int NAME_MAXIMUM = 60;

    public const int MOST_PER_EVENT = 50;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\Column(type: Types::STRING, length: 240)]
    private string $name;

    /** The name without case or accents, so "Bride's side" and "BRIDE'S SIDE" are one group. */
    #[ORM\Column(type: Types::STRING, length: 240)]
    private string $nameKey;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $deletedAt = null;

    public function __construct(Event $event, string $name, string $nameKey)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->name = $name;
        $this->nameKey = $nameKey;
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

    public function getNameKey(): string
    {
        return $this->nameKey;
    }

    public function setName(string $name, string $nameKey): void
    {
        $this->name = $name;
        $this->nameKey = $nameKey;
    }

    public function isDeleted(): bool
    {
        return null !== $this->deletedAt;
    }

    public function delete(DateTimeImmutable $at): void
    {
        $this->deletedAt = $at;
    }
}
