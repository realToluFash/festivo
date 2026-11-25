<?php

declare(strict_types=1);

namespace App\Deletion\Interfaces;

use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

/** What a purge must also remove that the foreign keys' cascade cannot reach: a row that pointed at what was purged rather than being beneath it. */
#[AutoconfigureTag(self::TAG)]
interface PurgedRowRemoverInterface
{
    public const string TAG = 'app.purged_row_remover';

    /** Run after the purge, in the same transaction: removes what nothing kept now points at. */
    public function remove(): void;
}
