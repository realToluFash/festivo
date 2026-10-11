<?php

declare(strict_types=1);

namespace App\Assistant;

use InvalidArgumentException;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Which assistant is behind the interface.
 *
 * A factory rather than an alias in configuration, because the choice is an
 * environment variable and a service id cannot be one. The same shape as
 * pointing SMS at Smocker or mail at Mailpit: a value in the environment, not
 * an edit to a file.
 *
 * Both adapters are constructed, which is free — neither opens a connection
 * until it is asked a question.
 */
final readonly class AssistantFactory
{
    public function __construct(
        #[Autowire('%env(ASSISTANT_PROVIDER)%')]
        private string $provider,
        private AnthropicAssistant $anthropic,
        private ScriptedAssistant $scripted,
    ) {
    }

    public function create(): Assistant
    {
        return match ($this->provider) {
            'anthropic' => $this->anthropic,
            Availability::STAND_IN => $this->scripted,
            // Named, and loudly. A typo falling back to the stand-in would
            // answer every organiser with scripted text that reads like a
            // feature rather than a misconfiguration.
            default => throw new InvalidArgumentException(sprintf(
                'Unknown ASSISTANT_PROVIDER "%s". Known providers: anthropic, %s.',
                $this->provider,
                Availability::STAND_IN,
            )),
        };
    }
}
