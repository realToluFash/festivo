<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** When a member last looked at an event's guest replies (sc-4331): its bell item read, or Changed since you looked chosen. Written through GuestReplyLog. */
#[ORM\Entity]
#[ORM\Table(name: 'guest_reply_looks')]
#[ORM\UniqueConstraint(name: 'uniq_guest_reply_look', columns: ['user_id', 'event_id'])]
class GuestReplyLook
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
    private DateTimeImmutable $lookedAt;

    public function __construct(Uuid $id, User $user, Event $event, DateTimeImmutable $lookedAt)
    {
        $this->id = $id;
        $this->user = $user;
        $this->event = $event;
        $this->lookedAt = $lookedAt;
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

    public function getLookedAt(): DateTimeImmutable
    {
        return $this->lookedAt;
    }
}
