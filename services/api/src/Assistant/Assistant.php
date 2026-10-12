<?php

declare(strict_types=1);

namespace App\Assistant;

/**
 * Whoever actually answers.
 *
 * One interface and one adapter per provider, the same shape as the address
 * lookup: switching is a class and a configuration value, and nothing above it
 * learns which provider is behind it. The local stand-in implements this too,
 * which is the point — the whole path runs in tests without a key.
 *
 * Deliberately NOT in this contract: the system prompt. It is resolved from the
 * context by the adapter, so there is no parameter a caller could use to
 * replace it. A client able to set the system prompt can undo every instruction
 * in it, and a contract that accepts one makes that a configuration mistake
 * rather than an impossibility.
 */
interface Assistant
{
    /** Configured AND switched on. */
    public function isEnabled(): bool;

    /** For the record — which provider answered. */
    public function provider(): string;

    /** For the record — and for the bill, which is priced per model. */
    public function model(): string;

    /**
     * @throws AssistantUnavailable the provider is busy or unreachable; the
     *                              caller may try again
     * @throws AssistantRefused     the model declined; trying again will not help
     * @throws AssistantFailed      anything else, which is ours to fix
     */
    public function chat(Ask $ask): Answer;
}
