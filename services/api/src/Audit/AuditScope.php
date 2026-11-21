<?php

declare(strict_types=1);

namespace App\Audit;

use Symfony\Component\Uid\Uuid;

/** Whose log an entry belongs in, and the names it needs once its subject is gone (sc-611). */
final readonly class AuditScope
{
    public function __construct(
        public ?Uuid $organisationId = null,
        public ?Uuid $eventId = null,
        public ?string $eventName = null,
        public ?string $target = null,
    ) {
    }
}
