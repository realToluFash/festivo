<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Export;

final readonly class DownloadedArchive
{
    public function __construct(
        public string $name,
        public string $bytes,
    ) {
    }
}
