<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\TwoFactorRecoveryStatus;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Lost both the authenticator and the recovery codes (sc-509): proved by codes, then answered by somebody else. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'two_factor_recoveries')]
#[ORM\UniqueConstraint(name: 'uniq_two_factor_recovery_hash', columns: ['token_hash'])]
#[ORM\Index(name: 'idx_two_factor_recovery_user', columns: ['user_id', 'created_at'])]
#[ORM\Index(name: 'idx_two_factor_recovery_status', columns: ['status', 'expires_at'])]
class TwoFactorRecovery
{
    use Timestampable;

    public const int LIFETIME_HOURS = 7 * 24;
    public const int PER_DAY = 3;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $tokenHash;

    #[ORM\ManyToOne(targetEntity: EmailAddress::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private EmailAddress $emailAddress;

    #[ORM\ManyToOne(targetEntity: PhoneNumber::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?PhoneNumber $phoneNumber;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: TwoFactorRecoveryStatus::class)]
    private TwoFactorRecoveryStatus $status = TwoFactorRecoveryStatus::Proving;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $provedAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $expiresAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $closedAt = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $decidedBy = null;

    public function __construct(User $user, string $tokenHash, EmailAddress $emailAddress, ?PhoneNumber $phoneNumber)
    {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->tokenHash = $tokenHash;
        $this->emailAddress = $emailAddress;
        $this->phoneNumber = $phoneNumber;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function setTokenHash(string $tokenHash): void
    {
        $this->tokenHash = $tokenHash;
    }

    public function getEmailAddress(): EmailAddress
    {
        return $this->emailAddress;
    }

    public function getPhoneNumber(): ?PhoneNumber
    {
        return $this->phoneNumber;
    }

    public function getProvedAt(): ?DateTimeImmutable
    {
        return $this->provedAt;
    }

    public function getExpiresAt(): ?DateTimeImmutable
    {
        return $this->expiresAt;
    }

    public function getClosedAt(): ?DateTimeImmutable
    {
        return $this->closedAt;
    }

    public function getDecidedBy(): ?User
    {
        return $this->decidedBy;
    }

    /** As it stands at that moment: a waiting request is expired from its instant on, before anything has written so. */
    public function statusAt(DateTimeImmutable $now): TwoFactorRecoveryStatus
    {
        $lapsed = TwoFactorRecoveryStatus::Waiting === $this->status && null !== $this->expiresAt && $now >= $this->expiresAt;

        return $lapsed ? TwoFactorRecoveryStatus::Expired : $this->status;
    }

    public function proved(DateTimeImmutable $now): void
    {
        $this->status = TwoFactorRecoveryStatus::Waiting;
        $this->provedAt = $now;
        $this->expiresAt = $now->modify('+' . self::LIFETIME_HOURS . ' hours');
    }

    public function close(TwoFactorRecoveryStatus $status, DateTimeImmutable $now, ?User $decidedBy = null): void
    {
        $this->status = $status;
        $this->closedAt = TwoFactorRecoveryStatus::Expired === $status && null !== $this->expiresAt ? $this->expiresAt : $now;
        $this->decidedBy = $decidedBy;
    }
}
