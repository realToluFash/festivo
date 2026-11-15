<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\PushTargetKind;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/** One device a member takes push on, while the session that registered it lasts (sc-3980). The address lets its holder send, so it is never logged. */
#[ORM\Entity]
#[ORM\Table(name: 'push_targets')]
#[ORM\UniqueConstraint(name: 'uniq_push_target_address', columns: ['address'])]
#[ORM\Index(name: 'idx_push_target_session', columns: ['session_id'])]
class PushTarget
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    /** The refresh chain it was registered under: signing out there forgets it. */
    #[ORM\Column(type: 'uuid')]
    private Uuid $sessionId;

    #[ORM\Column(type: Types::STRING, length: 8, enumType: PushTargetKind::class)]
    private PushTargetKind $kind;

    #[ORM\Column(type: Types::TEXT)]
    private string $address;

    /** Web Push's `p256dh` and `auth` keys, which encrypt the payload; null for Expo. */
    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $publicKey;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $authSecret;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    public function __construct(User $user, Uuid $sessionId, PushTargetKind $kind, #[SensitiveParameter] string $address, ?string $publicKey, #[SensitiveParameter] ?string $authSecret, DateTimeImmutable $createdAt)
    {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->sessionId = $sessionId;
        $this->kind = $kind;
        $this->address = $address;
        $this->publicKey = $publicKey;
        $this->authSecret = $authSecret;
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

    public function getSessionId(): Uuid
    {
        return $this->sessionId;
    }

    public function getKind(): PushTargetKind
    {
        return $this->kind;
    }

    public function getAddress(): string
    {
        return $this->address;
    }

    public function getPublicKey(): ?string
    {
        return $this->publicKey;
    }

    public function getAuthSecret(): ?string
    {
        return $this->authSecret;
    }

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }
}
