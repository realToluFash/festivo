<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

/** What one audience gets for an event action: a registered type, nothing yet because the story that adds it has not merged, or nothing by decision. */
final readonly class Notice
{
    private function __construct(
        public ?string $type,
        public ?string $awaiting,
    ) {
    }

    public static function type(string $type): self
    {
        return new self($type, null);
    }

    /** @param non-empty-string $story the story that registers its type, sc-N */
    public static function awaiting(string $story): self
    {
        return new self(null, $story);
    }

    public static function none(): self
    {
        return new self(null, null);
    }
}
