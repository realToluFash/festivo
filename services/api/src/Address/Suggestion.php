<?php

declare(strict_types=1);

namespace App\Address;

final readonly class Suggestion
{
    public function __construct(
        public string $id,
        public string $text,
        public ?string $secondaryText = null,
    ) {
    }

    /** @return array<string, string|null> */
    public function toArray(): array
    {
        return ['id' => $this->id, 'text' => $this->text, 'secondary_text' => $this->secondaryText];
    }
}
