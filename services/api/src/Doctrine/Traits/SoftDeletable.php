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

    public function getDeletedAt(): ?DateTimeImmutable
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?DateTimeImmutable $deletedAt): void
    {
        $this->deletedAt = $deletedAt;
    }

    public function getDeletedBy(): ?Uuid
    {
        return $this->deletedBy;
    }

    public function setDeletedBy(?Uuid $deletedBy): void
    {
        $this->deletedBy = $deletedBy;
    }

    public function isPurgeable(DateInterval $window, ?DateTimeImmutable $now = null): bool
    {
        if (null === $this->deletedAt) {
            return false;
        }

        return ($now ?? new DateTimeImmutable()) > $this->deletedAt->add($window);
    }
}
