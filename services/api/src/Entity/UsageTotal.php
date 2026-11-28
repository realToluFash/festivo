<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\UsageKind;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/** The running total the meter keeps per organisation, period and kind, so a read never sums the records (sc-3929). Written by `UsageMeter` alone. */
#[ORM\Entity(readOnly: true)]
#[ORM\Table(name: 'usage_totals')]
class UsageTotal
{
    #[ORM\Id]
    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\Id]
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $periodStart;

    #[ORM\Id]
    #[ORM\Column(type: Types::STRING, length: 20, enumType: UsageKind::class)]
    private UsageKind $kind;

    /** For storage, the latest measurement in bytes. */
    #[ORM\Column(type: Types::BIGINT, options: ['default' => 0])]
    private int $used = 0;

    #[ORM\Column(type: Types::BIGINT, options: ['default' => 0])]
    private int $includedUsed = 0;

    /** Set aside by reservations not yet settled or released. */
    #[ORM\Column(type: Types::BIGINT, options: ['default' => 0])]
    private int $includedHeld = 0;

    #[ORM\Column(type: Types::BIGINT, options: ['default' => 0])]
    private int $creditsTaken = 0;

    public function __construct(Organisation $organisation, DateTimeImmutable $periodStart, UsageKind $kind)
    {
        $this->organisation = $organisation;
        $this->periodStart = $periodStart;
        $this->kind = $kind;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getPeriodStart(): DateTimeImmutable
    {
        return $this->periodStart;
    }

    public function getKind(): UsageKind
    {
        return $this->kind;
    }

    public function getUsed(): int
    {
        return $this->used;
    }

    public function getIncludedUsed(): int
    {
        return $this->includedUsed;
    }

    public function getIncludedHeld(): int
    {
        return $this->includedHeld;
    }

    public function getCreditsTaken(): int
    {
        return $this->creditsTaken;
    }
}
