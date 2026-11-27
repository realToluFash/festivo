<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\UsageKind;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/** Where an organisation's use of one kind last stood against one threshold of its included amount, and the period it was last warned in (sc-3931). Written by `UsageWarnings` alone. */
#[ORM\Entity(readOnly: true)]
#[ORM\Table(name: 'usage_warnings')]
class UsageWarning
{
    #[ORM\Id]
    #[ORM\ManyToOne(targetEntity: Organisation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Organisation $organisation;

    #[ORM\Id]
    #[ORM\Column(type: Types::STRING, length: 20, enumType: UsageKind::class)]
    private UsageKind $kind;

    /** A percentage of the included amount. */
    #[ORM\Id]
    #[ORM\Column(type: Types::SMALLINT)]
    private int $threshold;

    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $above;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $warnedPeriodStart = null;

    public function __construct(Organisation $organisation, UsageKind $kind, int $threshold, bool $above)
    {
        $this->organisation = $organisation;
        $this->kind = $kind;
        $this->threshold = $threshold;
        $this->above = $above;
    }

    public function getOrganisation(): Organisation
    {
        return $this->organisation;
    }

    public function getKind(): UsageKind
    {
        return $this->kind;
    }

    public function getThreshold(): int
    {
        return $this->threshold;
    }

    public function isAbove(): bool
    {
        return $this->above;
    }

    public function getWarnedPeriodStart(): ?DateTimeImmutable
    {
        return $this->warnedPeriodStart;
    }
}
