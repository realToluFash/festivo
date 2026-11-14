<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/** An Android sign-in with Apple, from the app's start to the one-time handle that hands it back. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'apple_app_attempts')]
#[ORM\UniqueConstraint(name: 'uniq_apple_app_attempt_state', columns: ['state_hash'])]
#[ORM\UniqueConstraint(name: 'uniq_apple_app_attempt_handle', columns: ['handle_hash'])]
class AppleAppAttempt
{
    use Timestampable;

    /** Long enough to sign in at Apple. */
    public const int LIFETIME_MINUTES = 10;

    /** The handle in the App Link URL: usable once, and only for this long. */
    public const int HANDLE_SECONDS = 60;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $stateHash;

    #[ORM\Column(type: Types::STRING, length: 128)]
    private string $codeChallenge;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $expiresAt;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $code = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $appleUser = null;

    #[ORM\Column(type: Types::STRING, length: 64, nullable: true)]
    private ?string $handleHash = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $handleExpiresAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $usedAt = null;

    public function __construct(string $stateHash, string $codeChallenge, DateTimeImmutable $now)
    {
        $this->id = Uuid::v7();
        $this->stateHash = $stateHash;
        $this->codeChallenge = $codeChallenge;
        $this->expiresAt = $now->modify('+' . self::LIFETIME_MINUTES . ' minutes');
    }

    public function isAwaitingAppleAt(DateTimeImmutable $now): bool
    {
        return null === $this->handleHash && null === $this->usedAt && $now < $this->expiresAt;
    }

    public function received(#[SensitiveParameter] string $code, ?string $appleUser, string $handleHash, DateTimeImmutable $now): void
    {
        $this->code = $code;
        $this->appleUser = $appleUser;
        $this->handleHash = $handleHash;
        $this->handleExpiresAt = $now->modify('+' . self::HANDLE_SECONDS . ' seconds');
    }

    public function isHandleOpenAt(DateTimeImmutable $now): bool
    {
        return null === $this->usedAt && null !== $this->handleExpiresAt && $now < $this->handleExpiresAt;
    }

    public function getCodeChallenge(): string
    {
        return $this->codeChallenge;
    }

    public function getCode(): ?string
    {
        return $this->code;
    }

    public function getAppleUser(): ?string
    {
        return $this->appleUser;
    }

    /** Spent, and Apple's code forgotten with it. */
    public function markUsed(DateTimeImmutable $now): void
    {
        $this->usedAt = $now;
        $this->code = null;
    }
}
