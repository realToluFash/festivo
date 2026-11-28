<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/** How many soft bounces in a row an address has had since it last took an email: the third stops it as a hard bounce does (sc-3969). Written by `EmailSuppressions` alone. */
#[ORM\Entity(readOnly: true)]
#[ORM\Table(name: 'email_soft_bounces')]
class EmailSoftBounce
{
    /** {@see \App\Domain\Messaging\EmailAddressHash}: the address itself is never kept. */
    #[ORM\Id]
    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $addressHash;

    #[ORM\Column(name: 'in_a_row', type: Types::INTEGER)]
    private int $inARow;

    public function __construct(string $addressHash, int $inARow)
    {
        $this->addressHash = $addressHash;
        $this->inARow = $inARow;
    }

    public function getAddressHash(): string
    {
        return $this->addressHash;
    }

    public function getInARow(): int
    {
        return $this->inARow;
    }
}
