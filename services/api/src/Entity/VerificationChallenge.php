<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\VerificationChannel;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'verification_challenges')]
#[ORM\Index(name: 'idx_verification_challenge_email', columns: ['email_address_id'])]
#[ORM\Index(name: 'idx_verification_challenge_phone', columns: ['phone_number_id'])]
#[ORM\UniqueConstraint(name: 'uniq_live_challenge_per_email', columns: ['email_address_id'], options: ['where' => '(revoked_at IS NULL)'])]
#[ORM\UniqueConstraint(name: 'uniq_live_challenge_per_phone', columns: ['phone_number_id'], options: ['where' => '(revoked_at IS NULL)'])]
class VerificationChallenge
{
    use Timestampable;

    public const int CODE_LENGTH = 6;
    public const int LIFETIME_MINUTES = 15;
    public const int MAXIMUM_ATTEMPTS = 5;
    public const int RESEND_COOLDOWN_SECONDS = 60;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\Column(type: Types::STRING, length: 10, enumType: VerificationChannel::class)]
    private VerificationChannel $channel;

    #[ORM\ManyToOne(targetEntity: EmailAddress::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?EmailAddress $emailAddress = null;

    #[ORM\ManyToOne(targetEntity: PhoneNumber::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?PhoneNumber $phoneNumber = null;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $codeHash;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $expiresAt;

    #[ORM\Column(type: Types::INTEGER)]
    private int $attempts = 0;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $revokedAt = null;

    public function __construct(
        EmailAddress|PhoneNumber $subject,
        string $codeHash,
        DateTimeImmutable $expiresAt,
    ) {
        $this->id = Uuid::v7();
        $this->codeHash = $codeHash;
        $this->expiresAt = $expiresAt;

        if ($subject instanceof EmailAddress) {
            $this->channel = VerificationChannel::Email;
            $this->emailAddress = $subject;
        } else {
            $this->channel = VerificationChannel::Phone;
            $this->phoneNumber = $subject;
        }
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getChannel(): VerificationChannel
    {
        return $this->channel;
    }

    public function getEmailAddress(): ?EmailAddress
    {
        return $this->emailAddress;
    }

    public function getPhoneNumber(): ?PhoneNumber
    {
        return $this->phoneNumber;
    }

    public function getCodeHash(): string
    {
        return $this->codeHash;
    }

    public function getExpiresAt(): DateTimeImmutable
    {
        return $this->expiresAt;
    }

    public function getAttempts(): int
    {
        return $this->attempts;
    }

    public function getRevokedAt(): ?DateTimeImmutable
    {
        return $this->revokedAt;
    }

    public function setRevokedAt(?DateTimeImmutable $revokedAt): void
    {
        $this->revokedAt = $revokedAt;
    }

    public function isExhausted(): bool
    {
        return $this->attempts >= self::MAXIMUM_ATTEMPTS;
    }

    public function isExpired(): bool
    {
        return $this->expiresAt <= new DateTimeImmutable();
    }
}
