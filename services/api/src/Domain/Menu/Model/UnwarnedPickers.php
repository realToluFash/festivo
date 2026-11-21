<?php

declare(strict_types=1);

namespace App\Domain\Menu\Model;

/** The people who picked a dish and have one of the allergens just added to it recorded, until sc-3913 tells them (sc-3902, sc-3904). */
final readonly class UnwarnedPickers
{
    /** @param non-empty-list<string> $allergens the added allergens somebody counted has recorded, in Annex II order */
    public function __construct(
        public int $count,
        public array $allergens,
    ) {
    }
}
