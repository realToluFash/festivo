<?php

declare(strict_types=1);

namespace App\AI\Model;

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
