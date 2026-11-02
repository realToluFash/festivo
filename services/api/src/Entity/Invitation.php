<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\InvitationDelivery;
use App\Enum\InvitationStatus;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Not a membership: nothing exists until it is accepted. The token is kept only as its SHA-256. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'invitations')]
#[ORM\UniqueConstraint(name: 'uniq_invitation_token_hash', columns: ['token_hash'])]
#[ORM\UniqueConstraint(name: 'uniq_pending_invitation_per_email', columns: ['organisation_id', 'email'], options: ['where' => "((status)::text = 'pending'::text)"])]
#[ORM\Index(name: 'idx_invitation_email', columns: ['email'])]
class Invitation
{
    use Timestampable;

    public const int LIFETIME_DAYS = 7;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    /** Null once the organisation is deleted, so the link can still say so. */
    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Organisation $organisation;

    #[ORM\Column(type: Types::STRING, length: 100)]
    private string $organisationName;

    #[ORM\Column(type: Types::STRING, length: 180)]
    private string $email;

    #[ORM\ManyToOne(targetEntity: Role::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Role $role;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $invitedBy;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $tokenHash;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: InvitationStatus::class)]
    private InvitationStatus $status = InvitationStatus::Pending;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $expiresAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $acceptedAt = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $acceptedBy = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $declinedAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $revokedAt = null;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: InvitationDelivery::class)]
    private InvitationDelivery $delivery = InvitationDelivery::Queued;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $sentAt = null;

    public function __construct(Organisation $organisation, string $email, Role $role, User $invitedBy, string $tokenHash, DateTimeImmutable $expiresAt)
    {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->organisationName = $organisation->getName();
        $this->email = $email;
        $this->role = $role;
        $this->invitedBy = $invitedBy;
        $this->tokenHash = $tokenHash;
        $this->expiresAt = $expiresAt;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getOrganisation(): ?Organisation
    {
        return $this->organisation;
    }

    /** The organisation's name today, or the one it had when this was last sent if it is gone. */
    public function getOrganisationName(): string
    {
        return $this->organisation?->getName() ?? $this->organisationName;
    }

    public function setOrganisationName(string $organisationName): void
    {
        $this->organisationName = $organisationName;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function getRole(): ?Role
    {
        return $this->role;
    }

    public function setRole(Role $role): void
    {
        $this->role = $role;
    }

    public function getInvitedBy(): ?User
    {
        return $this->invitedBy;
    }

    public function setInvitedBy(User $invitedBy): void
    {
        $this->invitedBy = $invitedBy;
    }

    public function getTokenHash(): string
    {
        return $this->tokenHash;
    }

    public function setTokenHash(string $tokenHash): void
    {
        $this->tokenHash = $tokenHash;
    }

    public function getStatus(): InvitationStatus
    {
        return $this->status;
    }

    public function setStatus(InvitationStatus $status): void
    {
        $this->status = $status;
    }

    /** Pending past its expiry reads as expired, whether or not anybody has written that down yet. */
    public function getStatusAt(DateTimeImmutable $now): InvitationStatus
    {
        return InvitationStatus::Pending === $this->status && $now >= $this->expiresAt ? InvitationStatus::Expired : $this->status;
    }

    public function getExpiresAt(): DateTimeImmutable
    {
        return $this->expiresAt;
    }

    public function setExpiresAt(DateTimeImmutable $expiresAt): void
    {
        $this->expiresAt = $expiresAt;
    }

    public function getAcceptedAt(): ?DateTimeImmutable
    {
        return $this->acceptedAt;
    }

    public function setAcceptedAt(?DateTimeImmutable $acceptedAt): void
    {
        $this->acceptedAt = $acceptedAt;
    }

    public function getAcceptedBy(): ?User
    {
        return $this->acceptedBy;
    }

    public function setAcceptedBy(?User $acceptedBy): void
    {
        $this->acceptedBy = $acceptedBy;
    }

    public function getDeclinedAt(): ?DateTimeImmutable
    {
        return $this->declinedAt;
    }

    public function setDeclinedAt(?DateTimeImmutable $declinedAt): void
    {
        $this->declinedAt = $declinedAt;
    }

    public function getRevokedAt(): ?DateTimeImmutable
    {
        return $this->revokedAt;
    }

    public function setRevokedAt(?DateTimeImmutable $revokedAt): void
    {
        $this->revokedAt = $revokedAt;
    }

    public function getDelivery(): InvitationDelivery
    {
        return $this->delivery;
    }

    public function setDelivery(InvitationDelivery $delivery): void
    {
        $this->delivery = $delivery;
    }

    public function getSentAt(): ?DateTimeImmutable
    {
        return $this->sentAt;
    }

    public function setSentAt(?DateTimeImmutable $sentAt): void
    {
        $this->sentAt = $sentAt;
    }
}
