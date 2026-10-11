<?php

declare(strict_types=1);

namespace App\Assistant;

/**
 * A tool the client is offering to run.
 *
 * The client's, not ours. The agent loop lives there — it knows what it can do
 * on the screen the organiser is looking at — so the tool list arrives with
 * each request rather than being configured here. What this service does is
 * pass it through and record what was offered, so a later "why did it not do
 * that" can be answered.
 */
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
