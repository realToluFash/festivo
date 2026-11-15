<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One item of an event's running order: a real start, a length, a place and an owner (sc-3893). Its start is the wall-clock time in the event's zone, as the event's own is (docs/architecture/database.md). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'schedule_items')]
#[ORM\Index(name: 'idx_schedule_item_start', columns: ['event_id', 'starts_at'])]
class ScheduleItem
{
    use Timestampable;

    public const int TITLE_MAXIMUM = 120;

    public const int OWNER_NAME_MAXIMUM = 120;

    public const int OWNER_ROLE_MAXIMUM = 40;

    public const int NOTE_MAXIMUM = 500;

    public const int PLACE_MAXIMUM = 60;

    public const int LENGTH_MAXIMUM = 720;

    public const int PER_EVENT_MAXIMUM = 200;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\Column(type: Types::STRING, length: 480)]
    private string $title;

    /** Wall-clock, stored as if UTC; read only with the event's zone. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $startsAt;

    #[ORM\Column(type: Types::SMALLINT, nullable: true)]
    private ?int $lengthMinutes = null;

    /** Null is the event's one track, Main. */
    #[ORM\Column(type: Types::STRING, length: 240, nullable: true)]
    private ?string $place = null;

    #[ORM\Column(type: Types::STRING, length: 480, nullable: true)]
    private ?string $ownerName = null;

    #[ORM\Column(type: Types::STRING, length: 160, nullable: true)]
    private ?string $ownerRole = null;

    #[ORM\Column(type: Types::STRING, length: 2000, nullable: true)]
    private ?string $note = null;

    #[ORM\Column(type: Types::BOOLEAN, options: ['default' => false])]
    private bool $fixedTime = false;

    #[ORM\Column(type: Types::BOOLEAN, options: ['default' => false])]
    private bool $showToGuests = false;

    /** Who last changed it, named in a colleague's refused save. */
    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $changedBy;

    /** Moved by Doctrine on every update; the item's ETag. */
    #[ORM\Version]
    #[ORM\Column(type: Types::INTEGER, options: ['default' => 1])]
    private int $version = 1;

    public function __construct(Event $event, string $title, DateTimeImmutable $startsAt, ?User $changedBy)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->title = $title;
        $this->startsAt = $startsAt;
        $this->changedBy = $changedBy;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function getStartsAt(): DateTimeImmutable
    {
        return $this->startsAt;
    }

    public function getLengthMinutes(): ?int
    {
        return $this->lengthMinutes;
    }

    public function getPlace(): ?string
    {
        return $this->place;
    }

    public function getOwnerName(): ?string
    {
        return $this->ownerName;
    }

    public function getOwnerRole(): ?string
    {
        return $this->ownerRole;
    }

    public function getNote(): ?string
    {
        return $this->note;
    }

    public function isFixedTime(): bool
    {
        return $this->fixedTime;
    }

    public function isShownToGuests(): bool
    {
        return $this->showToGuests;
    }

    public function getChangedBy(): ?User
    {
        return $this->changedBy;
    }

    public function getVersion(): int
    {
        return $this->version;
    }

    public function describe(string $title, DateTimeImmutable $startsAt, ?int $lengthMinutes, ?string $place, ?string $ownerName, ?string $ownerRole, ?string $note, bool $fixedTime, bool $showToGuests, ?User $by): void
    {
        $this->title = $title;
        $this->startsAt = $startsAt;
        $this->lengthMinutes = $lengthMinutes;
        $this->place = $place;
        $this->ownerName = $ownerName;
        $this->ownerRole = $ownerRole;
        $this->note = $note;
        $this->fixedTime = $fixedTime;
        $this->showToGuests = $showToGuests;
        $this->changedBy = $by;
    }
}
