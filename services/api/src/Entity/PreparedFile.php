<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Symfony\Component\Uid\Uuid;

/** A file the server prepares after answering, for the one person who asked, downloadable signed in for a day from its being ready (App\Domain\Organisation\Export\PreparedFiles). */
interface PreparedFile
{
    public const string LINK_LIFETIME = 'PT24H';

    /** Tries in the background before the file is failed. */
    public const int MOST_ATTEMPTS = 3;

    /** How long a try is left alone before the next run takes it for stopped. */
    public const string RETRY_AFTER = 'PT5M';

    public function getId(): Uuid;

    public function isAskedBy(User $user): bool;

    public function isReady(): bool;

    public function getFileKey(): ?string;

    public function getReadyAt(): ?DateTimeImmutable;

    public function expiresAt(): ?DateTimeImmutable;
}
