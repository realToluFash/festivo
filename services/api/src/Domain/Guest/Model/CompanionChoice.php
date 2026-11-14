<?php

declare(strict_types=1);

namespace App\Domain\Guest\Model;

/** One companion as the guest left them on Who's coming with you? (sc-3779): a named place by its id, or a name for the next unnamed place when `id` is null. */
final readonly class CompanionChoice
{
    public function __construct(
        public ?string $id,
        public string $fullName,
        public string $nameKey,
        public bool $coming,
    ) {
    }
}
