<?php

declare(strict_types=1);

namespace App\AI\Factory;

use App\AI\Availability;
use App\AI\Interfaces\AssistantInterface;
use App\AI\ScriptedAssistant;
use App\Integrations\Anthropic\AnthropicAssistant;
use InvalidArgumentException;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

final readonly class AssistantFactory
{
    public function __construct(
        #[Autowire('%env(ASSISTANT_PROVIDER)%')]
        private string $provider,
        private AnthropicAssistant $anthropicAssistant,
        private ScriptedAssistant $scriptedAssistant,
    ) {
    }

    public function create(): AssistantInterface
    {
        return match ($this->provider) {
            'anthropic' => $this->anthropicAssistant,
            Availability::STAND_IN => $this->scriptedAssistant,

            default => throw new InvalidArgumentException(\sprintf(
                'Unknown ASSISTANT_PROVIDER "%s". Known providers: anthropic, %s.',
                $this->provider,
                Availability::STAND_IN,
            )),
        };
    }
}
