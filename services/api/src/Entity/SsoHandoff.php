<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A sign-in the identity provider vouched for (sc-610), waiting for the client to trade its one-time handle for a session. */
#[ORM\Entity]
#[ORM\Table(name: 'organisation_sso_handoffs')]
#[ORM\UniqueConstraint(name: 'uniq_sso_handoff_handle', columns: ['handle_hash'])]
class SsoHandoff
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: SsoProvider::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private SsoProvider $provider;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $handleHash;

    #[ORM\Column(type: Types::STRING, length: 128)]
    private string $clientChallenge;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $expiresAt;

    public function __construct(SsoProvider $provider, User $user, string $handleHash, string $clientChallenge, DateTimeImmutable $expiresAt)
    {
        $this->id = Uuid::v7();
        $this->provider = $provider;
        $this->user = $user;
        $this->handleHash = $handleHash;
        $this->clientChallenge = $clientChallenge;
        $this->expiresAt = $expiresAt;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getClientChallenge(): string
    {
        return $this->clientChallenge;
    }

    public function isOpenAt(DateTimeImmutable $at): bool
    {
        return $at < $this->expiresAt;
    }
}
