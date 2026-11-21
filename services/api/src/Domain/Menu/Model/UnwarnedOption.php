<?php

declare(strict_types=1);

namespace App\Domain\Menu\Model;

/** One line after a choice saves, until sc-3913: who picked this option and has an allergen just added to it recorded. */
final readonly class UnwarnedOption
{
    public function __construct(
        public string $optionId,
        public string $option,
        public UnwarnedPickers $pickers,
    ) {
    }
}
