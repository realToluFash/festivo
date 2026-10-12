<?php

declare(strict_types=1);

namespace App\Assistant;

/**
 * The model asking the client to run one of its tools.
 *
 * `callId` is the provider's handle for this call and has to come back on the
 * matching result, or the provider rejects the next request — so it is carried
 * through rather than regenerated.
 */
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
