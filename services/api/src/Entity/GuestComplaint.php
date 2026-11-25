<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/** An address a guest reported as spam, kept past the guest's removal as a keyed hash only, so the organisation never emails it again (sc-3942). Written by `GuestComplaints` alone. */
#[ORM\Entity(readOnly: true)]
#[ORM\Table(name: 'guest_complaints')]
class GuestComplaint
{
    #[ORM\Id]
    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\Id]
    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $addressHash;

    public function __construct(Organisation $organisation, string $addressHash)
    {
        $this->organisation = $organisation;
        $this->addressHash = $addressHash;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getAddressHash(): string
    {
        return $this->addressHash;
    }
}
