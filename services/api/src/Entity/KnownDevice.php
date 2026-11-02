<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Apart from refresh_tokens, which are pruned when they expire: a device stays known after its sessions are gone. */
#[ORM\Entity]
#[ORM\Table(name: 'known_devices')]
#[ORM\UniqueConstraint(name: 'uniq_known_device', columns: ['user_id', 'device_hash'])]
#[ORM\Index(name: 'idx_known_device_notified', columns: ['user_id', 'notified_at'])]
class KnownDevice
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $deviceHash;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $firstSeenAt;

    /** When the person was emailed about it; null when no email went (registration, recovery, or the daily cap). */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $notifiedAt = null;

    public function __construct(User $user, string $deviceHash, DateTimeImmutable $firstSeenAt)
    {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->deviceHash = $deviceHash;
        $this->firstSeenAt = $firstSeenAt;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getDeviceHash(): string
    {
        return $this->deviceHash;
    }

    public function getFirstSeenAt(): DateTimeImmutable
    {
        return $this->firstSeenAt;
    }

    public function getNotifiedAt(): ?DateTimeImmutable
    {
        return $this->notifiedAt;
    }
}
