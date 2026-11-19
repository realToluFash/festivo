<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\IdentityProvider;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A first factor that passed, waiting on the second. Kept as a hash, and short-lived. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'two_factor_challenges')]
#[ORM\UniqueConstraint(name: 'uniq_two_factor_challenge_hash', columns: ['token_hash'])]
#[ORM\Index(name: 'idx_two_factor_challenge_user', columns: ['user_id'])]
class TwoFactorChallenge
{
    use Timestampable;

    public const int LIFETIME_MINUTES = 5;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $tokenHash;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $expiresAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $usedAt = null;

    /** A first Google or Apple sign-in onto this account, linked only once the code passes. */
    #[ORM\Column(type: Types::STRING, length: 32, nullable: true, enumType: IdentityProvider::class)]
    private ?IdentityProvider $linkProvider = null;

    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $linkSubject = null;

    public function __construct(
        User $user,
        string $tokenHash,
        DateTimeImmutable $now,
        ?IdentityProvider $linkProvider = null,
        ?string $linkSubject = null,
    ) {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->tokenHash = $tokenHash;
        $this->expiresAt = $now->modify('+' . self::LIFETIME_MINUTES . ' minutes');
        $this->linkProvider = $linkProvider;
        $this->linkSubject = $linkSubject;
    }

    public function getLinkProvider(): ?IdentityProvider
    {
        return $this->linkProvider;
    }

    public function getLinkSubject(): ?string
    {
        return $this->linkSubject;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getExpiresAt(): DateTimeImmutable
    {
        return $this->expiresAt;
    }

    public function isOpenAt(DateTimeImmutable $now): bool
    {
        return null === $this->usedAt && $now < $this->expiresAt;
    }

    public function markUsed(DateTimeImmutable $now): void
    {
        $this->usedAt = $now;
    }
}
