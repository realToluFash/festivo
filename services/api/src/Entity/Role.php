<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\Permission;
use App\Enum\SeededRole;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One of an organisation's three roles (sc-29912): what each holds is fixed by SeededRole, the same in every organisation. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'roles')]
#[ORM\Index(name: 'idx_role_organisation', columns: ['organisation_id'])]
#[ORM\UniqueConstraint(name: 'uniq_seeded_role_per_organisation', columns: ['organisation_id', 'seeded_as'])]
class Role
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: SeededRole::class)]
    private SeededRole $seededAs;

    public function __construct(Organisation $organisation, SeededRole $seededAs)
    {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->seededAs = $seededAs;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getSeededAs(): SeededRole
    {
        return $this->seededAs;
    }

    /** @return list<Permission> every registered permission for Owner, including ones added later */
    public function getPermissions(): array
    {
        return $this->seededAs->defaults();
    }

    public function isOwner(): bool
    {
        return SeededRole::Owner === $this->seededAs;
    }
}
