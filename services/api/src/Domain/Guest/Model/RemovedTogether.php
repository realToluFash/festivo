<?php

declare(strict_types=1);

namespace App\Domain\Guest\Model;

/** What one Remove from the list on many guests did (sc-3776): `gone` counts the ids it could not act on, removed by someone else included. */
final readonly class RemovedTogether
{
    public function __construct(
        public ?string $removalId,
        public int $guests,
        public int $companions,
        public int $gone,
    ) {
    }
}
