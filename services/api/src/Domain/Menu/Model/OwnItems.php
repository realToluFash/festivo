<?php

declare(strict_types=1);

namespace App\Domain\Menu\Model;

/** Served with this course as Edit course sends it, checked by ItemRules (sc-34230). */
final readonly class OwnItems
{
    /** @param list<string> $names */
    public function __construct(
        public array $names,
    ) {
    }
}
