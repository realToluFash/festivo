<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A passkey kept as a second factor: its public key, and what the authenticator last said of itself. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'passkeys')]
#[ORM\UniqueConstraint(name: 'uniq_passkey_credential', columns: ['credential_id'])]
#[ORM\Index(name: 'idx_passkey_user', columns: ['user_id'])]
class Passkey
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    /** Base64url, as the browser names it. */
    #[ORM\Column(type: Types::STRING, length: 1400)]
    private string $credentialId;

    #[ORM\Column(type: Types::TEXT)]
    private string $publicKey;

    #[ORM\Column(type: Types::STRING, length: 36)]
    private string $aaguid;

    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $backedUp;

    #[ORM\Column(type: Types::BIGINT)]
    private string $signCount;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $lastUsedAt = null;

    public function __construct(User $user, string $credentialId, string $publicKey, string $aaguid, bool $backedUp, int $signCount, DateTimeImmutable $addedAt)
    {
        $this->id = Uuid::v7();
        $this->createdAt = $addedAt;
        $this->user = $user;
        $this->credentialId = $credentialId;
        $this->publicKey = $publicKey;
        $this->aaguid = $aaguid;
        $this->backedUp = $backedUp;
        $this->signCount = (string) $signCount;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getCredentialId(): string
    {
        return $this->credentialId;
    }

    public function getPublicKey(): string
    {
        return $this->publicKey;
    }

    public function getAaguid(): string
    {
        return $this->aaguid;
    }

    public function isBackedUp(): bool
    {
        return $this->backedUp;
    }

    public function setBackedUp(bool $backedUp): void
    {
        $this->backedUp = $backedUp;
    }

    public function getSignCount(): int
    {
        return (int) $this->signCount;
    }

    public function setSignCount(int $signCount): void
    {
        $this->signCount = (string) $signCount;
    }

    public function setLastUsedAt(DateTimeImmutable $lastUsedAt): void
    {
        $this->lastUsedAt = $lastUsedAt;
    }
}
