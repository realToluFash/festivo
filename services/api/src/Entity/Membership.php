<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\MembershipStatus;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use LogicException;
use Psl\Str;
use Symfony\Component\Uid\Uuid;

/** Always a real account: an invitation is its own record, and no membership exists until it is accepted. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'memberships')]
#[ORM\UniqueConstraint(name: 'uniq_membership_per_user', columns: ['organisation_id', 'user_id'])]
#[ORM\Index(name: 'idx_membership_organisation', columns: ['organisation_id'])]
#[ORM\Index(name: 'idx_membership_user', columns: ['user_id'])]
#[ORM\Index(name: 'idx_membership_role', columns: ['role_id'])]
class Membership
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    /** Exactly one per organisation (sc-66). */
    #[ORM\ManyToOne(targetEntity: Role::class)]
    #[ORM\JoinColumn(nullable: false)]
    private Role $role;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: MembershipStatus::class)]
    private MembershipStatus $status;

    /** When the account last joined: entering active, returning after leaving, or approved, but not reinstated from suspension. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $joinedAt = null;

    /** When the organisation's two-factor deadline first held this member back, for the audit trail (sc-609). */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $twoFactorBlockedAt = null;

    /** What the person wrote when asking through the request link (sc-562), for whoever answers. */
    #[ORM\Column(type: Types::STRING, length: 500, nullable: true)]
    private ?string $requestMessage = null;

    public function __construct(Organisation $organisation, User $user, Role $role, MembershipStatus $status, DateTimeImmutable $at)
    {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->user = $user;
        $this->role = $role;

        if (!$status->isEntry()) {
            throw new LogicException(Str\format('A membership cannot begin %s.', $status->value));
        }

        $this->status = $status;

        if (MembershipStatus::Active === $status) {
            $this->joinedAt = $at;
        }
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function getRole(): Role
    {
        return $this->role;
    }

    /** Only through RoleAssignment, which keeps the organisation's last owner. */
    public function changeRole(Role $role): void
    {
        $this->role = $role;
    }

    public function getStatus(): MembershipStatus
    {
        return $this->status;
    }

    /** Refuses any transition the machine does not declare (sc-67), whoever asks. */
    public function setStatus(MembershipStatus $status, DateTimeImmutable $at): void
    {
        if (!$this->status->canBecome($status)) {
            throw new LogicException(Str\format('A membership cannot go from %s to %s.', $this->status->value, $status->value));
        }

        if (MembershipStatus::Active === $status && MembershipStatus::Suspended !== $this->status) {
            $this->joinedAt = $at;
        }

        $this->status = $status;
    }

    public function isActive(): bool
    {
        return MembershipStatus::Active === $this->status;
    }

    public function getJoinedAt(): ?DateTimeImmutable
    {
        return $this->joinedAt;
    }

    public function getTwoFactorBlockedAt(): ?DateTimeImmutable
    {
        return $this->twoFactorBlockedAt;
    }

    public function setTwoFactorBlockedAt(?DateTimeImmutable $twoFactorBlockedAt): void
    {
        $this->twoFactorBlockedAt = $twoFactorBlockedAt;
    }

    public function getRequestMessage(): ?string
    {
        return $this->requestMessage;
    }

    public function setRequestMessage(?string $requestMessage): void
    {
        $this->requestMessage = $requestMessage;
    }
}
