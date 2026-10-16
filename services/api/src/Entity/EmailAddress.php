<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'email_addresses')]
#[ORM\UniqueConstraint(name: 'uniq_email_address', columns: ['address'])]
#[ORM\Index(name: 'idx_email_address_user', columns: ['user_id'])]
// Partial, so it says "one primary per user" and nothing about the rest. The
// `options` key is how Doctrine carries a PostgreSQL WHERE clause; without it
// schema:validate reports the index as something to drop on every run.
#[ORM\UniqueConstraint(name: 'uniq_primary_email_per_user', columns: ['user_id'], options: ['where' => 'is_primary'])]
class EmailAddress implements VerifiableContact
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class, inversedBy: 'emailAddresses')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    /** @var non-empty-string */
    #[ORM\Column(type: Types::STRING, length: 180)]
    private string $address;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $verifiedAt = null;

    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $isPrimary;

    /** @param non-empty-string $address already normalised — see App\Domain\User\EmailAddressNormaliser */
    public function __construct(User $user, string $address, bool $isPrimary = false)
    {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->address = $address;
        $this->isPrimary = $isPrimary;

        $user->addEmailAddress($this);
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    /** @return non-empty-string */
    public function getAddress(): string
    {
        return $this->address;
    }

    public function getVerifiedAt(): ?DateTimeImmutable
    {
        return $this->verifiedAt;
    }

    public function setVerifiedAt(?DateTimeImmutable $verifiedAt): void
    {
        $this->verifiedAt = $verifiedAt;
    }

    public function isPrimary(): bool
    {
        return $this->isPrimary;
    }

    public function setPrimary(bool $isPrimary): void
    {
        $this->isPrimary = $isPrimary;
    }

    public function isVerified(): bool
    {
        return null !== $this->verifiedAt;
    }
}
