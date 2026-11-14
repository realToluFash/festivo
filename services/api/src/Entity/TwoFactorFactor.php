<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

/** An authenticator app's shared secret, encrypted, and off until a code it made has matched. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'two_factor_factors')]
#[ORM\UniqueConstraint(name: 'uniq_two_factor_factor_user', columns: ['user_id'])]
class TwoFactorFactor
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\OneToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: Types::TEXT)]
    private string $encryptedSecret;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $activatedAt = null;

    /** The newest time step a code was accepted for: one at or before it is a replay. */
    #[ORM\Column(type: Types::BIGINT, nullable: true)]
    private ?string $lastAcceptedStep = null;

    public function __construct(User $user, #[SensitiveParameter] string $encryptedSecret)
    {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->encryptedSecret = $encryptedSecret;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getEncryptedSecret(): string
    {
        return $this->encryptedSecret;
    }

    public function isActive(): bool
    {
        return null !== $this->activatedAt;
    }

    public function activate(DateTimeImmutable $now): void
    {
        $this->activatedAt = $now;
    }

    public function getLastAcceptedStep(): ?int
    {
        return null === $this->lastAcceptedStep ? null : (int) $this->lastAcceptedStep;
    }

    public function accepted(int $step): void
    {
        $this->lastAcceptedStep = (string) $step;
    }
}
