<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A settle that lost to a key already recorded from another reservation, and what it gave back of its own hold, once (sc-3929, 27 Oct). */
#[ORM\Entity]
#[ORM\Table(name: 'usage_hold_releases')]
#[ORM\UniqueConstraint(name: 'uniq_usage_hold_release_key', columns: ['reservation_id', 'key_scope', 'idempotency_key'])]
class UsageHoldRelease
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: UsageReservation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private UsageReservation $reservation;

    #[ORM\Column(type: Types::STRING, length: 20)]
    private string $keyScope;

    #[ORM\Column(type: Types::STRING, length: 255)]
    private string $idempotencyKey;

    #[ORM\Column(type: Types::INTEGER)]
    private int $units;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $releasedAt;

    public function __construct(UsageReservation $reservation, string $keyScope, string $idempotencyKey, int $units, DateTimeImmutable $releasedAt)
    {
        $this->id = Uuid::v7();
        $this->reservation = $reservation;
        $this->keyScope = $keyScope;
        $this->idempotencyKey = $idempotencyKey;
        $this->units = $units;
        $this->releasedAt = $releasedAt;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getReservation(): UsageReservation
    {
        return $this->reservation;
    }

    public function getKeyScope(): string
    {
        return $this->keyScope;
    }

    public function getIdempotencyKey(): string
    {
        return $this->idempotencyKey;
    }

    public function getUnits(): int
    {
        return $this->units;
    }

    public function getReleasedAt(): DateTimeImmutable
    {
        return $this->releasedAt;
    }
}
