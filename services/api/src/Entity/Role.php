<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\Permission;
use App\Enum\SeededRole;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Psl\Dict;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** A named set of permissions belonging to one organisation (sc-66). Owner holds every permission. */
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

    /** Null for a role the organisation made itself, which then goes by `name`. */
    #[ORM\Column(type: Types::STRING, length: 20, nullable: true, enumType: SeededRole::class)]
    private ?SeededRole $seededAs;

    #[ORM\Column(type: Types::STRING, length: 40, nullable: true)]
    private ?string $name;

    /** @var list<string> the registry's values; Owner's is never read, since it holds everything */
    #[ORM\Column(type: Types::JSON, options: ['default' => '[]'])]
    private array $permissions;

    /** @param list<Permission> $permissions */
    private function __construct(Organisation $organisation, ?SeededRole $seededAs, ?string $name, array $permissions)
    {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->seededAs = $seededAs;
        $this->name = $name;
        $this->setPermissions($permissions);
    }

    /** Written once, when the organisation is made: afterwards the roles are the organisation's to change. */
    public static function seeded(Organisation $organisation, SeededRole $role): self
    {
        return new self($organisation, $role, null, $role->defaults());
    }

    /** @param list<Permission> $permissions */
    public static function custom(Organisation $organisation, string $name, array $permissions): self
    {
        return new self($organisation, null, $name, $permissions);
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getSeededAs(): ?SeededRole
    {
        return $this->seededAs;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function rename(string $name): void
    {
        $this->name = $name;
    }

    /** @return list<Permission> every registered permission for Owner, including ones added later */
    public function getPermissions(): array
    {
        if ($this->isOwner()) {
            return Permission::cases();
        }

        return Vec\filter_nulls(Vec\map($this->permissions, Permission::tryFrom(...)));
    }

    /** @param list<Permission> $permissions */
    public function setPermissions(array $permissions): void
    {
        $this->permissions = Vec\values(Dict\unique(Vec\map($permissions, static fn (Permission $permission): string => $permission->value)));
    }

    public function isOwner(): bool
    {
        return SeededRole::Owner === $this->seededAs;
    }
}
