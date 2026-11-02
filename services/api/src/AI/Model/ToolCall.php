<?php

declare(strict_types=1);

namespace App\AI\Model;

final readonly class ToolCall
{
    /** @param array<string, mixed> $args */
    public function __construct(
        public string $name,
        public array $args,
        public string $callId,
    ) {
    }
}
