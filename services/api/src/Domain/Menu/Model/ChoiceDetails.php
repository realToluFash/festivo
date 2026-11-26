<?php

declare(strict_types=1);

namespace App\Domain\Menu\Model;

/** A choice as its form sends it, checked by ChoiceRules: it may still be a draft. */
final readonly class ChoiceDetails
{
    /** @param list<OptionDetails> $options empty blocks already dropped, in the form's order */
    public function __construct(
        public string $question,
        public array $options,
        public int $pick,
        public bool $required,
    ) {
    }
}
