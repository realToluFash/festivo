<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Whether guests see their table on their page, and the day the host means to share by (sc-4022). Its own row, so sharing never moves the room's version. */
#[ORM\Entity]
#[ORM\Table(name: 'table_sharings')]
class TableSharing
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\OneToOne(targetEntity: SeatingPlan::class)]
    #[ORM\JoinColumn(nullable: false, unique: true, onDelete: 'CASCADE')]
    private SeatingPlan $plan;

    /** In UTC; null while guests see nothing about seating. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $sharedAt = null;

    /** A day in the event's own zone, at midnight UTC as a DATE column holds it; a nudge that never shares by itself. */
    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $shareBy = null;

    public function __construct(SeatingPlan $plan)
    {
        $this->id = Uuid::v7();
        $this->plan = $plan;
    }

    public function getPlan(): SeatingPlan
    {
        return $this->plan;
    }

    public function getSharedAt(): ?DateTimeImmutable
    {
        return $this->sharedAt;
    }

    public function isShared(): bool
    {
        return null !== $this->sharedAt;
    }

    public function share(DateTimeImmutable $at): void
    {
        $this->sharedAt ??= $at->setTimezone(new DateTimeZone('UTC'));
    }

    public function stop(): void
    {
        $this->sharedAt = null;
    }

    public function getShareBy(): ?DateTimeImmutable
    {
        return $this->shareBy;
    }

    public function setShareBy(?DateTimeImmutable $day): void
    {
        $this->shareBy = $day;
    }
}
