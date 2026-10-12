<?php

declare(strict_types=1);

namespace App\Assistant;

/**
 * Everything one turn needs, as one value.
 *
 * A single object rather than six parameters, because the recorder logs exactly
 * this alongside the answer — and because the next thing to add (a tool choice,
 * a budget) is then a field rather than a signature change rippling through
 * every adapter and double.
 */
final readonly class Ask
{
    /**
     * @param list<Turn>           $conversation    oldest first
     * @param list<ToolDefinition> $tools           what the client can run
     * @param string               $locale          the resolved request locale
     * @param ?string              $resourceContext what the organiser is looking at
     * @param ?string              $sessionId       the client's handle for this conversation
     */
    public function __construct(
        public AssistantContext $context,
        public array $conversation,
        public array $tools = [],
        public string $locale = 'en',
        public ?string $resourceContext = null,
        public ?string $sessionId = null,
    ) {
    }

    /**
     * The last thing the person typed, for the record.
     *
     * Null when the turn is being driven by a tool result rather than by
     * somebody typing, which is most turns in a long agent loop.
     */
    public function lastUserMessage(): ?string
    {
        foreach (array_reverse($this->conversation) as $turn) {
            if (TurnRole::User === $turn->role) {
                return $turn->text;
            }
        }

        return null;
    }
}
