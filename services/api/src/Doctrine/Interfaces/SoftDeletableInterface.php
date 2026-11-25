<?php

declare(strict_types=1);

namespace App\Doctrine\Interfaces;

use DateTimeImmutable;
use Symfony\Component\Uid\Uuid;

/** What the SoftDeletable trait gives an entity, for the code that restores one without knowing which. */
interface SoftDeletableInterface
{
    public function getId(): Uuid;

    public function isDeleted(): bool;

    public function getDeletedAt(): ?DateTimeImmutable;

    public function setDeletedAt(?DateTimeImmutable $deletedAt): void;

    public function setDeletedBy(?Uuid $deletedBy): void;
}
