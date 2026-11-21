<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One delivery of a person's own link (sc-3912): kept only as its token's SHA-256, and ended with every other of theirs by Replace link or their removal. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'staff_link_tokens')]
#[ORM\UniqueConstraint(name: 'uniq_staff_link_token_hash', columns: ['token_hash'])]
class StaffLinkToken
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: StaffMember::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private StaffMember $staffMember;

    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $tokenHash;

    public function __construct(StaffMember $staffMember, string $tokenHash)
    {
        $this->id = Uuid::v7();
        $this->staffMember = $staffMember;
        $this->tokenHash = $tokenHash;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getStaffMember(): StaffMember
    {
        return $this->staffMember;
    }

    public function getTokenHash(): string
    {
        return $this->tokenHash;
    }
}
