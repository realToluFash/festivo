<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\GuestChannel;
use App\Enum\GuestSuppressionReason;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/** An address an organisation no longer reaches on one channel, kept as a keyed hash only, so neither the guest's erasure nor the event's purge lifts it (sc-3942, sc-3969). Written by `GuestSuppressions` alone. */
#[ORM\Entity(readOnly: true)]
#[ORM\Table(name: 'guest_suppressions')]
class GuestSuppression
{
    #[ORM\Id]
    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\Id]
    #[ORM\Column(type: Types::STRING, length: 10, enumType: GuestChannel::class)]
    private GuestChannel $channel;

    #[ORM\Id]
    #[ORM\Column(type: Types::STRING, length: 64)]
    private string $addressHash;

    #[ORM\Column(type: Types::STRING, length: 20, enumType: GuestSuppressionReason::class)]
    private GuestSuppressionReason $reason;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $suppressedAt;

    public function __construct(Organisation $organisation, GuestChannel $channel, string $addressHash, GuestSuppressionReason $reason, DateTimeImmutable $suppressedAt)
    {
        $this->organisation = $organisation;
        $this->channel = $channel;
        $this->addressHash = $addressHash;
        $this->reason = $reason;
        $this->suppressedAt = $suppressedAt;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getChannel(): GuestChannel
    {
        return $this->channel;
    }

    public function getAddressHash(): string
    {
        return $this->addressHash;
    }

    public function getReason(): GuestSuppressionReason
    {
        return $this->reason;
    }

    public function getSuppressedAt(): DateTimeImmutable
    {
        return $this->suppressedAt;
    }
}
