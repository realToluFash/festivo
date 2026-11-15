<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\NotificationCategory;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One item in a member's bell (sc-3980), written by the in-app delivery whose id it takes. The event's id and name outlive the event. */
#[ORM\Entity]
#[ORM\Table(name: 'notification_items')]
#[ORM\Index(name: 'idx_notification_item_feed', columns: ['user_id', 'created_at'])]
#[ORM\Index(name: 'idx_notification_item_unread', columns: ['user_id'], options: ['where' => '(read_at IS NULL)'])]
#[ORM\Index(name: 'idx_notification_item_created', columns: ['created_at'])]
#[ORM\UniqueConstraint(name: 'uniq_notification_item_unread_thread', columns: ['user_id', 'thread'], options: ['where' => '((read_at IS NULL) AND (thread IS NOT NULL))'])]
class NotificationItem
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: Types::STRING, length: 30, enumType: NotificationCategory::class)]
    private NotificationCategory $category;

    #[ORM\Column(type: Types::TEXT)]
    private string $title;

    /** @var list<string> */
    #[ORM\Column(type: Types::JSON)]
    private array $lines;

    #[ORM\Column(type: 'uuid', nullable: true)]
    private ?Uuid $eventId;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $eventName;

    #[ORM\Column(type: Types::STRING, length: 500, nullable: true)]
    private ?string $place;

    /** Its push and email were held by Mute this event when it was delivered; a later change of the mute leaves it as it was. */
    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $muted;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $readAt = null;

    /** Deliveries sharing a thread update its one unread item rather than adding another (sc-13214). */
    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $thread = null;

    /** The source the unread item began with, which its type renders it from. */
    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $threadFrom = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    /** @param list<string> $lines */
    public function __construct(
        Uuid $id,
        User $user,
        NotificationCategory $category,
        string $title,
        array $lines,
        ?Uuid $eventId,
        ?string $eventName,
        ?string $place,
        bool $muted,
        DateTimeImmutable $createdAt,
    ) {
        $this->id = $id;
        $this->user = $user;
        $this->category = $category;
        $this->title = $title;
        $this->lines = $lines;
        $this->eventId = $eventId;
        $this->eventName = $eventName;
        $this->place = $place;
        $this->muted = $muted;
        $this->createdAt = $createdAt;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getCategory(): NotificationCategory
    {
        return $this->category;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    /** @return list<string> */
    public function getLines(): array
    {
        return $this->lines;
    }

    public function getEventId(): ?Uuid
    {
        return $this->eventId;
    }

    public function getEventName(): ?string
    {
        return $this->eventName;
    }

    public function getPlace(): ?string
    {
        return $this->place;
    }

    public function isMuted(): bool
    {
        return $this->muted;
    }

    public function getReadAt(): ?DateTimeImmutable
    {
        return $this->readAt;
    }

    public function setReadAt(?DateTimeImmutable $readAt): void
    {
        $this->readAt = $readAt;
    }

    public function getThread(): ?string
    {
        return $this->thread;
    }

    public function getThreadFrom(): ?string
    {
        return $this->threadFrom;
    }

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }
}
