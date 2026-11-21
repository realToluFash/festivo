<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A host's message to guests (sc-3942): its words go only to each guest's page, and its deliveries say who was told of it. Written through GuestMessageSender, in the transaction of its deliveries. */
#[ORM\Entity(readOnly: true)]
#[ORM\Table(name: 'guest_messages')]
#[ORM\Index(name: 'idx_guest_message_event', columns: ['event_id', 'created_at'])]
#[ORM\UniqueConstraint(name: 'uniq_guest_message_scheduled', columns: ['scheduled_notification_id'])]
class GuestMessage
{
    public const int SUBJECT_MAXIMUM = 150;

    public const int BODY_MAXIMUM = 10000;

    public const string ALL = 'all';

    public const string CHOSEN = 'chosen';

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\Column(type: Types::STRING, length: 10)]
    private string $audience;

    /** @var list<string> */
    #[ORM\Column(type: Types::JSON, options: ['jsonb' => true])]
    private array $chosenGuestIds = [];

    #[ORM\Column(type: Types::STRING, length: 600, nullable: true)]
    private ?string $subject;

    #[ORM\Column(type: Types::TEXT)]
    private string $body;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $createdBy;

    #[ORM\Column(type: Types::STRING, length: 255)]
    private string $createdByName;

    #[ORM\ManyToOne(targetEntity: ScheduledNotification::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ScheduledNotification $scheduledNotification;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function isToAll(): bool
    {
        return self::ALL === $this->audience;
    }

    /** @return list<string> */
    public function getChosenGuestIds(): array
    {
        return $this->chosenGuestIds;
    }

    public function getSubject(): ?string
    {
        return $this->subject;
    }

    public function getBody(): string
    {
        return $this->body;
    }

    public function getCreatedBy(): ?User
    {
        return $this->createdBy;
    }

    public function getCreatedByName(): string
    {
        return $this->createdByName;
    }

    public function getScheduledNotification(): ScheduledNotification
    {
        return $this->scheduledNotification;
    }

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }
}
