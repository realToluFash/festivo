<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A member's own Push or Email switch for one category (sc-3980). No row is the product default. */
#[ORM\Entity]
#[ORM\Table(name: 'notification_preferences')]
#[ORM\UniqueConstraint(name: 'uniq_notification_preference', columns: ['user_id', 'category', 'channel'])]
class NotificationPreference
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: Types::STRING, length: 30, enumType: NotificationCategory::class)]
    private NotificationCategory $category;

    #[ORM\Column(type: Types::STRING, length: 10, enumType: NotificationChannel::class)]
    private NotificationChannel $channel;

    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $allowed;

    public function __construct(User $user, NotificationCategory $category, NotificationChannel $channel, bool $allowed)
    {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->category = $category;
        $this->channel = $channel;
        $this->allowed = $allowed;
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

    public function getChannel(): NotificationChannel
    {
        return $this->channel;
    }

    public function isAllowed(): bool
    {
        return $this->allowed;
    }

    public function setAllowed(bool $allowed): void
    {
        $this->allowed = $allowed;
    }
}
