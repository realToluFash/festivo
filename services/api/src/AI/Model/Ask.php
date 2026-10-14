<?php

declare(strict_types=1);

namespace App\AI\Model;

use App\Enum\AssistantContext;
use App\Enum\TurnRole;

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
