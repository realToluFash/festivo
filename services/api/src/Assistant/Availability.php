<?php

declare(strict_types=1);

namespace App\Assistant;

use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Two questions, not one.
 *
 * CONFIGURED means there is a key to call with. ENABLED means this installation
 * wants the feature. They fail for different reasons and need different
 * answers: not configured is ours to fix, switched off is a choice somebody
 * made, and a single boolean covering both tells whoever is reading the logs
 * nothing about which it was.
 *
 * Kept out of the adapter so the gate can be asked without constructing a
 * client, which is what the endpoint does before it does anything else.
 */
final readonly class Availability
{
    /** The provider whose absence of a key would matter. */
    public const STAND_IN = 'scripted';

    public function __construct(
        #[Autowire('%env(ASSISTANT_PROVIDER)%')]
        private string $provider,
        #[Autowire('%env(ASSISTANT_API_KEY)%')]
        private string $apiKey,
        #[Autowire('%env(bool:ASSISTANT_ENABLED)%')]
        private bool $enabled,
    ) {
    }

    public function isConfigured(): bool
    {
        // The stand-in needs no key, which is the entire point of it: the suite
        // and CI run every assisted path without an account and without
        // spending a token.
        return self::STAND_IN === $this->provider || '' !== trim($this->apiKey);
    }

    /**
     * Switched on AND able to run.
     *
     * Both, because "enabled" with no key is a configuration that reports
     * itself as working and fails on the first request.
     */
    public function isEnabled(): bool
    {
        return $this->enabled && $this->isConfigured();
    }

    /** Why not, for the log line. Null when it is available. */
    public function unavailableReason(): ?string
    {
        return match (true) {
            !$this->isConfigured() => 'no provider key is configured',
            !$this->enabled => 'the assistant is switched off for this installation',
            default => null,
        };
    }
}
