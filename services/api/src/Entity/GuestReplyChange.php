<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\GuestChangeKind;
use App\Enum\GuestReply;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One thing a guest did that the event's members hear of under Guest replies (sc-4331), written through GuestReplyRecorder. */
#[ORM\Entity(readOnly: true)]
#[ORM\Table(name: 'guest_reply_changes')]
#[ORM\Index(name: 'idx_guest_reply_change_event', columns: ['event_id', 'created_at'])]
class GuestReplyChange
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\ManyToOne(targetEntity: Guest::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Guest $guest;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: GuestChangeKind::class)]
    private GuestChangeKind $kind;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::STRING, length: 16, nullable: true, enumType: GuestReply::class)]
    private ?GuestReply $answer;

    public function __construct(Uuid $id, Event $event, Guest $guest, GuestChangeKind $kind, ?GuestReply $answer, DateTimeImmutable $createdAt)
    {
        $this->id = $id;
        $this->event = $event;
        $this->guest = $guest;
        $this->kind = $kind;
        $this->answer = $answer;
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

    public function getGuest(): Guest
    {
        return $this->guest;
    }

    public function getKind(): GuestChangeKind
    {
        return $this->kind;
    }

    public function getAnswer(): ?GuestReply
    {
        return $this->answer;
    }

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }
}
