<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Proof, held by one client, that the person signed in again a moment ago: what changing how they sign in asks for (sc-510). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'sign_in_proofs')]
#[ORM\UniqueConstraint(name: 'uniq_sign_in_proof_hash', columns: ['token_hash'])]
#[ORM\Index(name: 'idx_sign_in_proof_user', columns: ['user_id'])]
class SignInProof
{
    use Timestampable;

    /** How long a proof stands; the screen promises not to ask again within it. */
    public const int MINUTES = 5;

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

    public function __construct(User $user, string $tokenHash, DateTimeImmutable $now)
    {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->tokenHash = $tokenHash;
        $this->expiresAt = $now->modify('+' . self::MINUTES . ' minutes');
    }

    public function getExpiresAt(): DateTimeImmutable
    {
        return $this->expiresAt;
    }

    public function standsFor(User $user, DateTimeImmutable $now): bool
    {
        return $this->user->getId()->equals($user->getId()) && $now < $this->expiresAt;
    }
}
