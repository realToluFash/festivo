<?php

declare(strict_types=1);

namespace App\Assistant;

/**
 * A tool on offer for this turn.
 *
 * Arriving from the client, which is a starting point and not the destination.
 * The server neither declares which tools belong to a context nor executes any
 * of them, so today it passes the list through and records what was offered —
 * enough to answer "why did it not do that", and not enough to authorise
 * anything.
 *
 * Where this is going: the context declares its tools and the server executes
 * them, so the access check sits inside the tool rather than wherever the tool
 * eventually lands. sc-79 and sc-77. Until then, treat a tool name here as a
 * client's claim.
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
