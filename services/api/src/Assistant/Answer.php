<?php

declare(strict_types=1);

namespace App\Assistant;

/**
 * One turn's answer: text, or a tool to run. Never both, never neither.
 *
 * The exclusivity is the contract the client's agent loop runs on — text means
 * show it and stop, a call means run it and come back — so it is enforced here
 * rather than left to each adapter to get right.
 */
final readonly class Answer
{
    private function __construct(
        public ?string $text,
        public ?ToolCall $toolCall,
        public int $inputTokens = 0,
        public int $outputTokens = 0,
    ) {
    }

    public static function text(string $text, int $inputTokens = 0, int $outputTokens = 0): self
    {
        return new self($text, null, $inputTokens, $outputTokens);
    }

    public static function call(ToolCall $call, int $inputTokens = 0, int $outputTokens = 0): self
    {
        return new self(null, $call, $inputTokens, $outputTokens);
    }

    public function isToolCall(): bool
    {
        return null !== $this->toolCall;
    }
}
