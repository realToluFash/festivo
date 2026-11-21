<?php

declare(strict_types=1);

namespace App\Domain\Menu\Model;

/** What guests have answered to a choice (sc-3907): the options a stored answer names, and how many answered None for me. */
final readonly class ChoiceAnswers
{
    /** @param list<string> $pickedOptionIds */
    public function __construct(
        public array $pickedOptionIds,
        public int $noneAnswers,
    ) {
    }

    public function answered(): bool
    {
        return [] !== $this->pickedOptionIds || $this->noneAnswers > 0;
    }
}
