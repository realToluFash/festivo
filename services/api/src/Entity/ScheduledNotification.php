<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\NotificationHold;
use App\Enum\NotificationPriority;
use App\Enum\ScheduledNotificationStatus;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One row of the one clock (sc-104): what is due, when, for whom. Written and claimed through NotificationScheduler and the worker. */
#[ORM\Entity(readOnly: true)]
#[ORM\Table(name: 'scheduled_notifications')]
#[ORM\UniqueConstraint(name: 'uniq_scheduled_notification_pending_key', columns: ['cancellation_key'], options: ['where' => "((status)::text = 'pending'::text)"])]
#[ORM\Index(name: 'idx_scheduled_notification_due', columns: ['priority', 'due_at'], options: ['where' => "((status)::text = 'pending'::text)"])]
#[ORM\Index(name: 'idx_scheduled_notification_oldest', columns: ['due_at'], options: ['where' => "((status)::text = 'pending'::text)"])]
#[ORM\Index(name: 'idx_scheduled_notification_claimed', columns: ['claimed_at'])]
#[ORM\Index(name: 'idx_scheduled_notification_event', columns: ['event_id'])]
class ScheduledNotification
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\Column(type: Types::STRING, length: 80)]
    private string $type;

    #[ORM\Column(type: Types::STRING, length: 255)]
    private string $cancellationKey;

    #[ORM\Column(type: Types::STRING, length: 255)]
    private string $sourceId;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?Event $event = null;

    /** @var array<string, mixed> */
    #[ORM\Column(type: Types::JSON, options: ['jsonb' => true])]
    private array $trigger = [];

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $dueAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $sendBy = null;

    /** @var array<string, mixed> */
    #[ORM\Column(type: Types::JSON, options: ['jsonb' => true])]
    private array $audience = [];

    /** @var array<string, mixed> */
    #[ORM\Column(type: Types::JSON, options: ['jsonb' => true])]
    private array $payload = [];

    #[ORM\Column(type: Types::SMALLINT, enumType: NotificationPriority::class)]
    private NotificationPriority $priority;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: ScheduledNotificationStatus::class)]
    private ScheduledNotificationStatus $status = ScheduledNotificationStatus::Pending;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $fannedOutAfter = null;

    #[ORM\Column(type: Types::STRING, length: 20, nullable: true, enumType: NotificationHold::class)]
    private ?NotificationHold $held = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $claimedAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $claimedUntil = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $outcome = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $finishedAt = null;

    public function __construct(Uuid $id, string $type, string $cancellationKey, string $sourceId, DateTimeImmutable $dueAt, NotificationPriority $priority, DateTimeImmutable $createdAt)
    {
        $this->id = $id;
        $this->type = $type;
        $this->cancellationKey = $cancellationKey;
        $this->sourceId = $sourceId;
        $this->dueAt = $dueAt;
        $this->priority = $priority;
        $this->createdAt = $createdAt;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getCancellationKey(): string
    {
        return $this->cancellationKey;
    }

    public function getSourceId(): string
    {
        return $this->sourceId;
    }

    public function getEvent(): ?Event
    {
        return $this->event;
    }

    /** @return array<string, mixed> */
    public function getTrigger(): array
    {
        return $this->trigger;
    }

    public function getDueAt(): DateTimeImmutable
    {
        return $this->dueAt;
    }

    public function getSendBy(): ?DateTimeImmutable
    {
        return $this->sendBy;
    }

    /** @return array<string, mixed> */
    public function getAudience(): array
    {
        return $this->audience;
    }

    /** @return array<string, mixed> */
    public function getPayload(): array
    {
        return $this->payload;
    }

    public function getPriority(): NotificationPriority
    {
        return $this->priority;
    }

    public function getStatus(): ScheduledNotificationStatus
    {
        return $this->status;
    }

    public function getFannedOutAfter(): ?string
    {
        return $this->fannedOutAfter;
    }

    public function getHeld(): ?NotificationHold
    {
        return $this->held;
    }

    public function getClaimedAt(): ?DateTimeImmutable
    {
        return $this->claimedAt;
    }

    public function getClaimedUntil(): ?DateTimeImmutable
    {
        return $this->claimedUntil;
    }

    public function getOutcome(): ?string
    {
        return $this->outcome;
    }

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getFinishedAt(): ?DateTimeImmutable
    {
        return $this->finishedAt;
    }
}
