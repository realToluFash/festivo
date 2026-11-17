<?php

declare(strict_types=1);

namespace App\Domain\Guest\Model;

use App\Enum\GuestExportFormat;

/** The file a host downloads or shares (sc-3784), and its name as the dialog showed it. */
final readonly class ExportedGuests
{
    public function __construct(
        public string $name,
        public GuestExportFormat $format,
        public string $content,
    ) {
    }
}
