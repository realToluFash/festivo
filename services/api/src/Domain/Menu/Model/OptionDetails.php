<?php

declare(strict_types=1);

namespace App\Domain\Menu\Model;

/** One option of a choice as its form sends it; `id` names an option the choice already has. */
final readonly class OptionDetails
{
    /** @param list<string> $allergens in Annex II order; empty is "contains none of these" */
    public function __construct(
        public ?string $id,
        public string $name,
        public array $allergens,
    ) {
    }
}
