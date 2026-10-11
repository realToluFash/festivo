<?php

declare(strict_types=1);

namespace App\Doctrine;

use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * Deletion that can be undone, for a while.
 *
 * Support cannot help with a hard delete — "it's gone" is the entire
 * conversation — and the people who most need help are the ones who deleted
 * something an hour before an event.
 *
 * Rows carrying this are excluded from reads by the SoftDeleteFilter unless a
 * caller explicitly asks for them. After the recovery window a scheduled job
 * removes them for real.
 */
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

    public function softDelete(?Uuid $by = null): void
    {
        $this->deletedAt = new DateTimeImmutable();
        $this->deletedBy = $by;
    }

    public function restore(): void
    {
        $this->deletedAt = null;
        $this->deletedBy = null;
    }

    /**
     * Whether the recovery window has passed.
     *
     * The window is a grace period, not a lawful basis for keeping somebody's
     * data — an explicit erasure request hard-deletes regardless of it.
     */
    public function isPurgeable(DateInterval $window, ?DateTimeImmutable $now = null): bool
    {
        if (null === $this->deletedAt) {
            return false;
        }

        return ($now ?? new DateTimeImmutable()) > $this->deletedAt->add($window);
    }
}
