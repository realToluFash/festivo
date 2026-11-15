<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/** The photo an organiser chose for an event (sc-3590). No row is the type's default cover. Kept off Event so a new cover does not move the event's ETag. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'event_covers')]
class EventCover
{
    use Timestampable;

    public const int DESCRIPTION_MAXIMUM = 250;

    #[ORM\Id]
    #[ORM\OneToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    /** The published sizes sit under it, at `<photoKey>/<size>.webp`. */
    #[ORM\Column(type: Types::STRING, length: 200)]
    private string $photoKey;

    /** How far down the photo the 16:9 frame sits, 0 the top and 100 the bottom. */
    #[ORM\Column(type: Types::SMALLINT)]
    private int $position;

    #[ORM\Column(type: Types::STRING, length: 250, nullable: true)]
    private ?string $description;

    public function __construct(Event $event, string $photoKey, int $position, ?string $description)
    {
        $this->event = $event;
        $this->photoKey = $photoKey;
        $this->position = $position;
        $this->description = $description;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getPhotoKey(): string
    {
        return $this->photoKey;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setPhotoKey(string $photoKey): void
    {
        $this->photoKey = $photoKey;
    }

    public function setPosition(int $position): void
    {
        $this->position = $position;
    }

    public function setDescription(?string $description): void
    {
        $this->description = $description;
    }
}
