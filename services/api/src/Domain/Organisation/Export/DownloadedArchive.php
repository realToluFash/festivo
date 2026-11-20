<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Export;

final readonly class DownloadedArchive
{
    /** @param iterable<string> $chunks the kept archive in pieces */
    public function __construct(
        public string $name,
        public iterable $chunks,
    ) {
    }
}
