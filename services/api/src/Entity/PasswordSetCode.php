<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Psl\Math;
use Symfony\Component\Uid\Uuid;

/** The emailed code a Google or Apple account proves its address with before it may add a password (sc-391). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'password_set_codes')]
#[ORM\UniqueConstraint(name: 'uniq_password_set_code_user', columns: ['user_id'])]
class PasswordSetCode
{
    use Timestampable;

    /** How long a passed code lets the password be chosen. */
    public const int PASSED_MINUTES = 15;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $codeHash;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $codeExpiresAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $codeSentAt;

    #[ORM\Column(type: Types::INTEGER)]
    private int $attempts = 0;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $passedAt = null;

    /** The one-time token the client that passed the code holds; another session on the account has none. */
    #[ORM\Column(type: Types::STRING, length: 64, nullable: true)]
    private ?string $stepUpHash = null;

    public function __construct(User $user, string $codeHash, DateTimeImmutable $now)
    {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->codeHash = $codeHash;
        $this->codeSentAt = $now;
        $this->codeExpiresAt = $now->modify('+' . VerificationChallenge::LIFETIME_MINUTES . ' minutes');
    }

    /** A resend replaces the code, its tries and any pass: what counts is the newest email. */
    public function newCode(string $codeHash, DateTimeImmutable $now): void
    {
        $this->codeHash = $codeHash;
        $this->codeSentAt = $now;
        $this->codeExpiresAt = $now->modify('+' . VerificationChallenge::LIFETIME_MINUTES . ' minutes');
        $this->attempts = 0;
        $this->passedAt = null;
        $this->stepUpHash = null;
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

    /** A code passes once (sc-13138): after that only a new code can. */
    public function isPassed(): bool
    {
        return null !== $this->passedAt;
    }

    public function wrongAttempt(): void
    {
        ++$this->attempts;
    }

    public function passed(string $stepUpHash, DateTimeImmutable $now): void
    {
        $this->passedAt = $now;
        $this->stepUpHash = $stepUpHash;
    }

    /** Only for the token the pass was given to, within its fifteen minutes, and only once; a wrong one burns nothing. */
    public function takeStepUp(string $stepUpHash, DateTimeImmutable $now): bool
    {
        $usable = null !== $this->passedAt
            && null !== $this->stepUpHash
            && $now < $this->passedAt->modify('+' . self::PASSED_MINUTES . ' minutes')
            && \hash_equals($this->stepUpHash, $stepUpHash);

        if ($usable) {
            $this->stepUpHash = null;
        }

        return $usable;
    }

    public function secondsUntilResendAt(DateTimeImmutable $now): int
    {
        return Math\maxva(0, $this->codeSentAt->getTimestamp() + VerificationChallenge::RESEND_COOLDOWN_SECONDS - $now->getTimestamp());
    }
}
