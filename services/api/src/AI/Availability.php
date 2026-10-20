<?php

declare(strict_types=1);

namespace App\AI;

use SensitiveParameter;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

final readonly class Availability
{
    public const STAND_IN = 'scripted';

    public function __construct(
        #[Autowire('%env(ASSISTANT_PROVIDER)%')]
        private string $provider,
        #[Autowire('%env(ASSISTANT_API_KEY)%')]
        #[SensitiveParameter]
        private string $apiKey,
        #[Autowire('%env(bool:ASSISTANT_ENABLED)%')]
        private bool $enabled,
    ) {
    }

    public function isConfigured(): bool
    {
        return self::STAND_IN === $this->provider || '' !== \trim($this->apiKey);
    }

    public function isEnabled(): bool
    {
        return $this->enabled && $this->isConfigured();
    }

    public function unavailableReason(): ?string
    {
        return match (true) {
            !$this->isConfigured() => 'no provider key is configured',
            !$this->enabled => 'the assistant is switched off for this installation',
            default => null,
        };
    }
}
