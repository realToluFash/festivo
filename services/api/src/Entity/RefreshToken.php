<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;
use Symfony\Component\Uid\UuidV7;

/**
 * A session. Opaque and stored hashed rather than a second JWT, because nothing
 * consults a server to use a JWT, so one cannot be revoked and "sign out this
 * device" could not be honoured.
 */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'refresh_tokens')]
#[ORM\UniqueConstraint(name: 'uniq_refresh_token_hash', columns: ['token_hash'])]
#[ORM\Index(name: 'idx_refresh_token_user', columns: ['user_id'])]
#[ORM\Index(name: 'idx_refresh_token_chain', columns: ['chain_id'])]
class RefreshToken
{
    use Timestampable;

    public const string LIFETIME = 'P30D';

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $tokenHash;

    /** Shared by every token descended from one sign-in. */
    #[ORM\Column(type: 'uuid')]
    private Uuid $chainId;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $expiresAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $revokedAt = null;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $userAgent = null;

    #[ORM\Column(type: Types::STRING, length: 45, nullable: true)]
    private ?string $ipAddress = null;

    public function __construct(
        User $user,
        string $tokenHash,
        ?Uuid $chainId = null,
        ?string $userAgent = null,
        ?string $ipAddress = null,
    ) {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->chainId = $chainId ?? $this->id;
        $this->tokenHash = $tokenHash;
        $this->expiresAt = new DateTimeImmutable()->add(new DateInterval(self::LIFETIME));
        $this->userAgent = $userAgent;
        $this->ipAddress = $ipAddress;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getChainId(): Uuid
    {
        return $this->chainId;
    }

    /**
     * When the sign-in happened, not when this token was issued. Rotation makes
     * a new row every refresh, so this row's createdAt is minutes old however
     * long the person has been signed in.
     *
     * Read off the chain id, which is the first token's id and so a time-ordered
     * UUID v7. No column and no second query.
     */
    public function getChainStartedAt(): DateTimeImmutable
    {
        if ($this->chainId instanceof UuidV7) {
            return DateTimeImmutable::createFromInterface($this->chainId->getDateTime());
        }

        return $this->getCreatedAt();
    }

    public function getExpiresAt(): DateTimeImmutable
    {
        return $this->expiresAt;
    }

    public function getRevokedAt(): ?DateTimeImmutable
    {
        return $this->revokedAt;
    }

    public function getUserAgent(): ?string
    {
        return $this->userAgent;
    }

    public function getIpAddress(): ?string
    {
        return $this->ipAddress;
    }

    public function setRevokedAt(?DateTimeImmutable $revokedAt): void
    {
        $this->revokedAt = $revokedAt;
    }

    public function isUsable(?DateTimeImmutable $now = null): bool
    {
        if (null !== $this->revokedAt) {
            return false;
        }

        return ($now ?? new DateTimeImmutable()) < $this->expiresAt;
    }
}
