<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\IdentityProvider;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A provider's own name for a person, its `sub`, which never changes even when their address does. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'provider_identities')]
#[ORM\UniqueConstraint(name: 'uniq_provider_subject', columns: ['provider', 'subject'])]
#[ORM\Index(name: 'idx_provider_identity_user', columns: ['user_id'])]
class ProviderIdentity
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: Types::STRING, length: 32, enumType: IdentityProvider::class)]
    private IdentityProvider $provider;

    #[ORM\Column(type: Types::STRING, length: 255)]
    private string $subject;

    /** The address the provider last vouched for, shown on Security; only ever one it said it verified. */
    #[ORM\Column(type: Types::STRING, length: 180, nullable: true)]
    private ?string $email;

    public function __construct(User $user, IdentityProvider $provider, string $subject, ?string $email = null)
    {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->provider = $provider;
        $this->subject = $subject;
        $this->email = $email;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getProvider(): IdentityProvider
    {
        return $this->provider;
    }

    public function getSubject(): string
    {
        return $this->subject;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    /** A provider's address can change under the same `sub`; null keeps the one on record. */
    public function vouchedFor(?string $email): void
    {
        $this->email = $email ?? $this->email;
    }
}
