<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\AssistantContext;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * The guard for every context added after this one.
 *
 * A context is a product decision arriving with the feature it assists, which
 * means it will be added by somebody working on seating or on the run of show
 * and not on this. These are the three ways that goes wrong quietly.
 */
final class AssistantContextTest extends TestCase
{
    #[Test]
    public function everyContextHasASubstantialSystemPrompt(): void
    {
        foreach (AssistantContext::cases() as $context) {
            // A placeholder prompt is worse than none: the assistant answers
            // confidently with no idea what product it is in.
            self::assertGreaterThan(
                200,
                \strlen(\trim($context->systemPrompt())),
                "{$context->value} has no real system prompt",
            );
        }
    }

    /**
     * Two contexts billed under one name is a meter that cannot separate them,
     * and the previous build's version of this mistake double-charged every
     * assisted action.
     */
    #[Test]
    public function everyContextIsBilledUnderItsOwnName(): void
    {
        $features = \array_map(
            static fn (AssistantContext $c): string => $c->usageFeature(),
            AssistantContext::cases(),
        );

        self::assertSame(\array_unique($features), $features, 'Two contexts share a usage feature');
    }

    /**
     * Namespaced, so the meter can report everything the assistant costs
     * without listing each context by hand.
     */
    #[Test]
    public function everyUsageFeatureIsNamespacedUnderTheAssistant(): void
    {
        foreach (AssistantContext::cases() as $context) {
            self::assertStringStartsWith('assistant.', $context->usageFeature());
        }
    }

    /**
     * The prompt is the cached prefix of every request in its context. A date,
     * a name or a count in it changes the prefix and bills the whole prompt
     * again — a cost regression with no symptom.
     */
    #[Test]
    public function noSystemPromptCarriesSomethingThatVariesPerRequest(): void
    {
        foreach (AssistantContext::cases() as $context) {
            $prompt = $context->systemPrompt();

            self::assertDoesNotMatchRegularExpression(
                '/\{\{|%[a-z_]+%|\$\{/',
                $prompt,
                "{$context->value} looks interpolated — per-request values belong in SystemPrompt",
            );
        }
    }
}
