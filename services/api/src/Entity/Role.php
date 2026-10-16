<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\SeededRole;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
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

    /** Null for a role the organisation made itself; its label is then `name`. */
    #[ORM\Column(type: Types::STRING, length: 20, nullable: true, enumType: SeededRole::class)]
    private ?SeededRole $seededAs;

    #[ORM\Column(type: Types::STRING, length: 40, nullable: true)]
    private ?string $name;

    private function __construct(Organisation $organisation, ?SeededRole $seededAs, ?string $name)
    {
        $this->id = Uuid::v7();
        $this->organisation = $organisation;
        $this->seededAs = $seededAs;
        $this->name = $name;
    }

    public static function seeded(Organisation $organisation, SeededRole $role): self
    {
        return new self($organisation, $role, null);
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

    public function isOwner(): bool
    {
        return SeededRole::Owner === $this->seededAs;
    }
}
