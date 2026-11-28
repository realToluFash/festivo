<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/** One Test sign-on sent to the identity provider (sc-610), answered once or never. */
#[ORM\Entity]
#[ORM\Table(name: 'organisation_sso_attempts')]
#[ORM\UniqueConstraint(name: 'uniq_sso_attempt_state', columns: ['state_hash'])]
class SsoAttempt
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: SsoProvider::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private SsoProvider $provider;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $startedBy;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $stateHash;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $nonce;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $codeVerifier;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $expiresAt;

    public function __construct(
        SsoProvider $provider,
        User $startedBy,
        string $stateHash,
        string $nonce,
        #[SensitiveParameter]
        string $codeVerifier,
        DateTimeImmutable $expiresAt,
    ) {
        $this->id = Uuid::v7();
        $this->provider = $provider;
        $this->startedBy = $startedBy;
        $this->stateHash = $stateHash;
        $this->nonce = $nonce;
        $this->codeVerifier = $codeVerifier;
        $this->expiresAt = $expiresAt;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getProvider(): SsoProvider
    {
        return $this->provider;
    }

    public function getStartedBy(): User
    {
        return $this->startedBy;
    }

    public function getNonce(): string
    {
        return $this->nonce;
    }

    public function getCodeVerifier(): string
    {
        return $this->codeVerifier;
    }

    public function isOpenAt(DateTimeImmutable $at): bool
    {
        return $at < $this->expiresAt;
    }
}
