<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A reset link, kept only as the SHA-256 of what was emailed. It works once, and not for long. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'password_reset_tokens')]
#[ORM\UniqueConstraint(name: 'uniq_password_reset_token_hash', columns: ['token_hash'])]
#[ORM\Index(name: 'idx_password_reset_token_user', columns: ['user_id'])]
class PasswordResetToken
{
    use Timestampable;

    /** Shorter than a verification code's fifteen: a reset link changes how the account is entered. */
    public const int LIFETIME_MINUTES = 10;

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

    /** With two-factor on, a code passed for this link, so the new password may be set. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $secondFactorPassedAt = null;

    public function __construct(User $user, string $tokenHash, DateTimeImmutable $now)
    {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->tokenHash = $tokenHash;
        $this->expiresAt = $now->modify('+' . self::LIFETIME_MINUTES . ' minutes');
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function isUsed(): bool
    {
        return null !== $this->usedAt;
    }

    public function isExpiredAt(DateTimeImmutable $now): bool
    {
        return $now >= $this->expiresAt;
    }

    public function passedSecondFactor(DateTimeImmutable $now): void
    {
        $this->secondFactorPassedAt = $now;
    }

    public function hasPassedSecondFactor(): bool
    {
        return null !== $this->secondFactorPassedAt;
    }

    public function markUsed(DateTimeImmutable $now): void
    {
        $this->usedAt = $now;
    }
}
