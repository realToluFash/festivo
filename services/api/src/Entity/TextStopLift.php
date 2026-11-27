<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/** One organisation whose texts a guest turned back on, with the Text messages switch, after texting STOP to Soirely's number (sc-3946). Written by `GuestSuppressions` alone. */
#[ORM\Entity(readOnly: true)]
#[ORM\Table(name: 'text_stop_lifts')]
class TextStopLift
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
