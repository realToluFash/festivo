<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Mute this event (sc-3980): one person's, never the organisation's. Its items still reach the bell. */
#[ORM\Entity]
#[ORM\Table(name: 'event_mutes')]
#[ORM\UniqueConstraint(name: 'uniq_event_mute', columns: ['user_id', 'event_id'])]
#[ORM\Index(name: 'idx_event_mute_event', columns: ['event_id'])]
class EventMute
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $mutedAt;

    public function __construct(User $user, Event $event, DateTimeImmutable $mutedAt)
    {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->event = $event;
        $this->mutedAt = $mutedAt;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getMutedAt(): DateTimeImmutable
    {
        return $this->mutedAt;
    }
}
