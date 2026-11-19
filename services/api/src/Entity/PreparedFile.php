<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Symfony\Component\Uid\Uuid;

/** A file the server prepares after answering, for the one person who asked, downloadable signed in for a day from its being ready (App\Storage\PreparedFiles). */
interface PreparedFile
{
    public const string LINK_LIFETIME = 'PT24H';

    public function getId(): Uuid;

    public function isAskedBy(User $user): bool;

    public function isReady(): bool;

    public function getFileKey(): ?string;

    public function getReadyAt(): ?DateTimeImmutable;

    public function expiresAt(): ?DateTimeImmutable;
}
