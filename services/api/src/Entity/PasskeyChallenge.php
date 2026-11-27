<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\PasskeyStep;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A WebAuthn challenge, kept as a hash: one member, one step, used once. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'passkey_challenges')]
#[ORM\UniqueConstraint(name: 'uniq_passkey_challenge_hash', columns: ['challenge_hash'])]
#[ORM\Index(name: 'idx_passkey_challenge_user', columns: ['user_id'])]
class PasskeyChallenge
{
    use Timestampable;

    public const int LIFETIME_MINUTES = 5;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: PasskeyStep::class)]
    private PasskeyStep $step;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $challengeHash;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $expiresAt;

    public function __construct(User $user, PasskeyStep $step, string $challengeHash, DateTimeImmutable $now)
    {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->step = $step;
        $this->challengeHash = $challengeHash;
        $this->expiresAt = $now->modify('+' . self::LIFETIME_MINUTES . ' minutes');
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getStep(): PasskeyStep
    {
        return $this->step;
    }

    public function getExpiresAt(): DateTimeImmutable
    {
        return $this->expiresAt;
    }
}
