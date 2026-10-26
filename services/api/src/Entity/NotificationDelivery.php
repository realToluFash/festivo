<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationChannel;
use App\Enum\NotificationDeliveryStatus;
use App\Enum\NotificationHold;
use App\Enum\NotificationPriority;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** The outbox and the log (sc-104): one person, one channel, one send. The unique key is epic 36's idempotency key. */
#[ORM\Entity(readOnly: true)]
#[ORM\Table(name: 'notification_deliveries')]
#[ORM\UniqueConstraint(name: 'uniq_notification_delivery_idempotency', columns: ['type', 'source_id', 'recipient_kind', 'recipient_id', 'channel'])]
#[ORM\Index(name: 'idx_notification_delivery_next', columns: ['priority', 'next_attempt_at'], options: ['where' => "((status)::text = 'pending'::text)"])]
#[ORM\Index(name: 'idx_notification_delivery_finished', columns: ['finished_at'])]
#[ORM\Index(name: 'idx_notification_delivery_scheduled', columns: ['scheduled_notification_id'])]
#[ORM\Index(name: 'idx_notification_delivery_event', columns: ['event_id'])]
class NotificationDelivery
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: ScheduledNotification::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ScheduledNotification $scheduledNotification;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?Event $event = null;

    #[ORM\Column(type: Types::STRING, length: 80)]
    private string $type;

    #[ORM\Column(type: Types::STRING, length: 255)]
    private string $sourceId;

    #[ORM\Column(type: Types::STRING, length: 10, enumType: NotificationAudienceKind::class)]
    private NotificationAudienceKind $recipientKind;

    #[ORM\Column(type: 'uuid')]
    private Uuid $recipientId;

    #[ORM\Column(type: Types::STRING, length: 10, enumType: NotificationChannel::class)]
    private NotificationChannel $channel;

    #[ORM\Column(type: Types::SMALLINT, enumType: NotificationPriority::class)]
    private NotificationPriority $priority;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $collapseKey = null;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: NotificationDeliveryStatus::class)]
    private NotificationDeliveryStatus $status = NotificationDeliveryStatus::Pending;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $dueAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $nextAttemptAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $sendBy = null;

    #[ORM\Column(type: Types::INTEGER, options: ['default' => 0])]
    private int $attempts = 0;

    #[ORM\Column(type: Types::STRING, length: 20, nullable: true, enumType: NotificationHold::class)]
    private ?NotificationHold $held = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $claimedAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $claimedUntil = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $finishedAt = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $lastError = null;

    #[ORM\Column(type: 'uuid', nullable: true)]
    private ?Uuid $collapsedInto = null;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $providerMessageId = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    public function __construct(
        Uuid $id,
        ScheduledNotification $scheduledNotification,
        NotificationAudienceKind $recipientKind,
        Uuid $recipientId,
        NotificationChannel $channel,
        NotificationPriority $priority,
        DateTimeImmutable $dueAt,
        DateTimeImmutable $createdAt,
    ) {
        $this->id = $id;
        $this->scheduledNotification = $scheduledNotification;
        $this->event = $scheduledNotification->getEvent();
        $this->type = $scheduledNotification->getType();
        $this->sourceId = $scheduledNotification->getSourceId();
        $this->recipientKind = $recipientKind;
        $this->recipientId = $recipientId;
        $this->channel = $channel;
        $this->priority = $priority;
        $this->dueAt = $dueAt;
        $this->nextAttemptAt = $dueAt;
        $this->createdAt = $createdAt;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getScheduledNotification(): ScheduledNotification
    {
        return $this->scheduledNotification;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getRecipientKind(): NotificationAudienceKind
    {
        return $this->recipientKind;
    }

    public function getRecipientId(): Uuid
    {
        return $this->recipientId;
    }

    public function getChannel(): NotificationChannel
    {
        return $this->channel;
    }

    public function getPriority(): NotificationPriority
    {
        return $this->priority;
    }

    public function getStatus(): NotificationDeliveryStatus
    {
        return $this->status;
    }

    public function getAttempts(): int
    {
        return $this->attempts;
    }

    public function getNextAttemptAt(): DateTimeImmutable
    {
        return $this->nextAttemptAt;
    }

    public function getHeld(): ?NotificationHold
    {
        return $this->held;
    }

    public function getLastError(): ?string
    {
        return $this->lastError;
    }

    public function getCollapsedInto(): ?Uuid
    {
        return $this->collapsedInto;
    }

    public function getProviderMessageId(): ?string
    {
        return $this->providerMessageId;
    }

    public function getFinishedAt(): ?DateTimeImmutable
    {
        return $this->finishedAt;
    }

    public function getCollapseKey(): ?string
    {
        return $this->collapseKey;
    }

    public function getSendBy(): ?DateTimeImmutable
    {
        return $this->sendBy;
    }

    public function getClaimedAt(): ?DateTimeImmutable
    {
        return $this->claimedAt;
    }

    public function getClaimedUntil(): ?DateTimeImmutable
    {
        return $this->claimedUntil;
    }
}
