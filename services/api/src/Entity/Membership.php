<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\MembershipStatus;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
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

    public function __construct(Organisation $organisation, User $user, Role $role, MembershipStatus $status)
    {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->user = $user;
        $this->role = $role;
        $this->status = $status;
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

    public function getStatus(): MembershipStatus
    {
        return $this->status;
    }

    public function isActive(): bool
    {
        return MembershipStatus::Active === $this->status;
    }
}
