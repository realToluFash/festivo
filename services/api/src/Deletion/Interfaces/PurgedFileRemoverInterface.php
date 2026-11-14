<?php

declare(strict_types=1);

namespace App\Deletion\Interfaces;

use DateTimeImmutable;
use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

/** What a purge must also remove that the foreign keys' cascade cannot reach: a file in the object store. */
#[AutoconfigureTag(self::TAG)]
interface PurgedFileRemoverInterface
{
    public const string TAG = 'app.purged_file_remover';

    /**
     * Read before the purge, while the rows that name the files are still there.
     *
     * @return list<string>
     */
    public function purgedBy(DateTimeImmutable $cutoff): array;

    /** @param list<string> $keys */
    public function remove(array $keys): void;
}
