<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\MailProviderReport;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/** An address a hard bounce or a complaint stopped for every non-security email (sc-4332). What the person sees of it is sc-44949. */
#[ORM\Entity(readOnly: true)]
#[ORM\Table(name: 'email_suppressions')]
class EmailSuppression
{
    /** {@see \App\Domain\Messaging\EmailAddressHash}: the address itself is never kept. */
    #[ORM\Id]
    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $addressHash;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: MailProviderReport::class)]
    private MailProviderReport $reason;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $suppressedAt;

    public function __construct(string $addressHash, MailProviderReport $reason, DateTimeImmutable $suppressedAt)
    {
        $this->addressHash = $addressHash;
        $this->reason = $reason;
        $this->suppressedAt = $suppressedAt;
    }

    public function getAddressHash(): string
    {
        return $this->addressHash;
    }

    public function getReason(): MailProviderReport
    {
        return $this->reason;
    }

    public function getSuppressedAt(): DateTimeImmutable
    {
        return $this->suppressedAt;
    }
}
