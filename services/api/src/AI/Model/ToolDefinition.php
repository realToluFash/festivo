<?php

declare(strict_types=1);

namespace App\AI\Model;

final readonly class ToolDefinition
{
    /** @param array<string, mixed> $inputSchema JSON Schema for the tool's arguments */
    public function __construct(
        public string $name,
        public string $description,
        public array $inputSchema,
    ) {
    }
}
