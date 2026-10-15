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
#[ORM\Table(name: 'phone_numbers')]
#[ORM\UniqueConstraint(name: 'uniq_phone_number', columns: ['number'])]
#[ORM\Index(name: 'idx_phone_number_user', columns: ['user_id'])]
#[ORM\UniqueConstraint(name: 'uniq_primary_phone_per_user', columns: ['user_id'], options: ['where' => 'is_primary'])]
class PhoneNumber
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: User::class, inversedBy: 'phoneNumbers')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: Types::STRING, length: 32)]
    private string $number;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $verifiedAt = null;

    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $isPrimary;

    public function __construct(User $user, string $number, bool $isPrimary = false)
    {
        $this->id = Uuid::v7();
        $this->user = $user;
        $this->number = $number;
        $this->isPrimary = $isPrimary;

        $user->addPhoneNumber($this);
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getNumber(): string
    {
        return $this->number;
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
