<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/** A number that texted STOP to Soirely's number, which stops every organisation's texts to it (sc-3946); a keyed hash only. Written by `GuestSuppressions` alone. */
#[ORM\Entity(readOnly: true)]
#[ORM\Table(name: 'text_stops')]
class TextStop
{
    #[ORM\Id]
    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $addressHash;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $stoppedAt;

    public function __construct(string $addressHash, DateTimeImmutable $stoppedAt)
    {
        $this->addressHash = $addressHash;
        $this->stoppedAt = $stoppedAt;
    }

    public function getAddressHash(): string
    {
        return $this->addressHash;
    }

    public function getStoppedAt(): DateTimeImmutable
    {
        return $this->stoppedAt;
    }
}
