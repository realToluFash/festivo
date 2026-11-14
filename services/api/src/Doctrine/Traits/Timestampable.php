<?php

declare(strict_types=1);

namespace App\Doctrine\Traits;

use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Created and updated timestamps, maintained by Doctrine rather than by the
 * entity's own methods.
 *
 * The alternative is a private touch() that every mutator has to remember to
 * call. User had seven of them, and the eighth mutator anybody adds is one
 * nobody notices is missing: the row simply stops reporting when it last
 * changed, and no test fails.
 *
 * The entity using this MUST carry #[ORM\HasLifecycleCallbacks]. Without it
 * Doctrine never looks for the callbacks and the timestamps quietly stop
 * moving. TimestampableTest enforces it, because there is no error.
 */
trait Timestampable
{
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $updatedAt;

    public function getCreatedAt(): DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): DateTimeImmutable
    {
        return $this->updatedAt;
    }

    /**
     * ??= rather than =, so an entity that sets them in its constructor keeps
     * its own values. Reading an uninitialised typed property throws, but
     * isset() semantics answer false for one without throwing, which is what
     * makes this safe.
     */
    #[ORM\PrePersist]
    public function initialiseTimestamps(): void
    {
        $now = new DateTimeImmutable();

        $this->createdAt ??= $now;
        $this->updatedAt ??= $now;
    }

    #[ORM\PreUpdate]
    public function refreshUpdatedAt(): void
    {
        $this->updatedAt = new DateTimeImmutable();
    }
}
