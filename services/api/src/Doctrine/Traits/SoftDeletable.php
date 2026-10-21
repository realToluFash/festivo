<?php

declare(strict_types=1);

namespace App\Doctrine\Traits;

use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

trait SoftDeletable
{
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $deletedAt = null;

    #[ORM\Column(type: 'uuid', nullable: true)]
    private ?Uuid $deletedBy = null;

    public function isDeleted(): bool
    {
        return null !== $this->deletedAt;
    }

    public function deletedAt(): ?DateTimeImmutable
    {
        return $this->deletedAt;
    }

    public function deletedBy(): ?Uuid
    {
        return $this->deletedBy;
    }

    public function softDelete(?Uuid $by = null, ?DateTimeImmutable $at = null): void
    {
        $this->deletedAt = $at ?? new DateTimeImmutable();
        $this->deletedBy = $by;
    }

    public function restore(): void
    {
        $this->deletedAt = null;
        $this->deletedBy = null;
    }

    public function isPurgeable(DateInterval $window, ?DateTimeImmutable $now = null): bool
    {
        if (null === $this->deletedAt) {
            return false;
        }

        return ($now ?? new DateTimeImmutable()) > $this->deletedAt->add($window);
    }
}
