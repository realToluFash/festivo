<?php

declare(strict_types=1);

namespace App\Assistant;

/**
 * One turn in the conversation.
 *
 * Built through the named constructors rather than directly, because the four
 * kinds use different fields and a constructor taking all of them nullable
 * lets you build a tool result with no call id.
 */
final readonly class Turn
{
    /**
     * @param array<string, mixed>|null $args
     */
    private function __construct(
        public TurnRole $role,
        public ?string $text = null,
        public ?string $callId = null,
        public ?string $name = null,
        public ?array $args = null,
        public mixed $result = null,
    ) {
    }

    public static function user(string $text): self
    {
        return new self(TurnRole::User, text: $text);
    }

    public static function assistant(string $text): self
    {
        return new self(TurnRole::Assistant, text: $text);
    }

    /** @param array<string, mixed> $args */
    public static function toolCall(string $callId, string $name, array $args): self
    {
        return new self(TurnRole::ToolCall, callId: $callId, name: $name, args: $args);
    }

    public static function toolResult(string $callId, mixed $result): self
    {
        return new self(TurnRole::ToolResult, callId: $callId, result: $result);
    }
}
