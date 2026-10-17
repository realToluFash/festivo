<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Psl\Math;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/** A password sign-up waiting on its emailed code. The account exists only once the code proves the address. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'pending_registrations')]
#[ORM\UniqueConstraint(name: 'uniq_pending_registration_handle', columns: ['handle_hash'])]
#[ORM\Index(name: 'idx_pending_registration_email', columns: ['email'])]
class PendingRegistration
{
    use Timestampable;

    public const int LIFETIME_HOURS = 24;

    /** The "you already have an account" email, at most this often per address. */
    public const int ALREADY_REGISTERED_EMAIL_MINUTES = 60;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $handleHash;

    #[ORM\Column(type: Types::STRING, length: 180)]
    private string $email;

    #[ORM\Column(type: Types::STRING, length: 255)]
    private string $name;

    /** Null for a taken address: nothing is ever created from it. */
    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    private ?string $passwordHash;

    #[ORM\Column(type: Types::STRING, length: 8, nullable: true)]
    private ?string $locale;

    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $forTakenAddress;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $codeHash;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $codeExpiresAt;

    #[ORM\Column(type: Types::INTEGER)]
    private int $attempts = 0;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $codeSentAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $alreadyRegisteredEmailedAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $expiresAt;

    public function __construct(
        string $handleHash,
        string $email,
        string $name,
        #[SensitiveParameter]
        ?string $passwordHash,
        ?string $locale,
        bool $forTakenAddress,
        DateTimeImmutable $now,
    ) {
        $this->id = Uuid::v7();
        $this->handleHash = $handleHash;
        $this->email = $email;
        $this->name = $name;
        $this->passwordHash = $passwordHash;
        $this->locale = $locale;
        $this->forTakenAddress = $forTakenAddress;
        $this->codeHash = '';
        $this->codeExpiresAt = $now;
        $this->codeSentAt = $now;
        $this->expiresAt = $now->modify('+' . self::LIFETIME_HOURS . ' hours');
    }

    /** A new code replaces the last, with its attempts and its fifteen minutes, as sc-56's do. */
    public function newCode(string $codeHash, DateTimeImmutable $now): void
    {
        $this->codeHash = $codeHash;
        $this->codeExpiresAt = $now->modify('+' . VerificationChallenge::LIFETIME_MINUTES . ' minutes');
        $this->attempts = 0;
        $this->codeSentAt = $now;
    }

    public function isOpenAt(DateTimeImmutable $now): bool
    {
        return $now < $this->expiresAt;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getPasswordHash(): ?string
    {
        return $this->passwordHash;
    }

    public function getLocale(): ?string
    {
        return $this->locale;
    }

    public function isForTakenAddress(): bool
    {
        return $this->forTakenAddress;
    }

    public function getCodeHash(): string
    {
        return $this->codeHash;
    }

    public function isCodeExpiredAt(DateTimeImmutable $now): bool
    {
        return $now >= $this->codeExpiresAt;
    }

    public function isExhausted(): bool
    {
        return $this->attempts >= VerificationChallenge::MAXIMUM_ATTEMPTS;
    }

    public function wrongAttempt(): void
    {
        ++$this->attempts;
    }

    public function secondsUntilResendAt(DateTimeImmutable $now): int
    {
        return Math\maxva(0, $this->codeSentAt->getTimestamp() + VerificationChallenge::RESEND_COOLDOWN_SECONDS - $now->getTimestamp());
    }

    public function alreadyRegisteredEmailed(DateTimeImmutable $now): void
    {
        $this->alreadyRegisteredEmailedAt = $now;
    }
}
