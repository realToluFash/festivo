<?php

declare(strict_types=1);

namespace App\Assistant;

use Psl\Str;

/**
 * The assistant, locally, with no key and no network.
 *
 * The same reason Mailpit, Smocker and the OIDC sandbox exist. Without it every
 * test touching an assisted path spends real tokens against a real provider,
 * which means the tests are slow, non-deterministic and billable — so they do
 * not get written, and CI cannot run that path at all.
 *
 * It answers scripted replies, and a directive at the start of the last message
 * chooses which. That makes every branch reachable from the product itself, not
 * only from a test: somebody building the client can see what their loop does
 * with a tool call, a refusal and an outage without waiting for one to happen.
 *
 *   !tool [name]  ask the client to run a tool — the named one, or the first
 *   !refuse       the model declines
 *   !busy         the provider is busy
 *   !fail         something is broken on our side
 *
 * Anything else gets a canned reply that names the context and the language it
 * was asked in, so a test can assert that the locale travelled from the request
 * header all the way into the ask rather than asserting on a prompt nobody
 * sent anywhere.
 */
final readonly class ScriptedAssistant implements Assistant
{
    public function __construct(private Availability $availability)
    {
    }

    public function isEnabled(): bool
    {
        return $this->availability->isEnabled();
    }

    public function provider(): string
    {
        // Named so a recorded interaction cannot be mistaken for a real one.
        return Availability::STAND_IN;
    }

    public function model(): string
    {
        return 'scripted';
    }

    public function chat(Ask $ask): Answer
    {
        $message = Str\trim($ask->lastUserMessage() ?? '');
        [$directive, $argument] = $this->directive($message);

        return match ($directive) {
            '!refuse' => throw new AssistantRefused('The assistant would not answer that.'),
            '!busy' => throw new AssistantUnavailable('The assistant is busy. Please try again.'),
            '!fail' => throw new AssistantFailed('A scripted failure.'),
            '!tool' => $this->toolCall($ask, $argument),
            default => Answer::text($this->reply($ask, $message), inputTokens: 0, outputTokens: 0),
        };
    }

    /** @return array{0: string, 1: ?string} */
    private function directive(string $message): array
    {
        if (!Str\starts_with($message, '!')) {
            return ['', null];
        }

        $words = Str\split($message, ' ', 2);

        return [$words[0], $words[1] ?? null];
    }

    private function toolCall(Ask $ask, ?string $name): Answer
    {
        $tool = null;

        foreach ($ask->tools as $offered) {
            if (null === $name || $offered->name === $name) {
                $tool = $offered;
                break;
            }
        }

        if (null === $tool) {
            // Said plainly rather than silently answering with text. A client
            // asking for a tool call and getting prose would be debugging its
            // own loop.
            throw new AssistantFailed(sprintf(
                'No tool to call: the request offered %s.',
                [] === $ask->tools ? 'none' : sprintf('%d, none named "%s"', \count($ask->tools), $name),
            ));
        }

        return Answer::call(new ToolCall(
            name: $tool->name,
            args: [],
            // Fixed rather than random, so a test can assert the id that comes
            // back on the result without reading it out of the response first.
            callId: 'scripted_call_1',
        ));
    }

    private function reply(Ask $ask, string $message): string
    {
        return sprintf(
            'Scripted reply in the %s context, answering in %s. You said: %s',
            $ask->context->value,
            $ask->locale,
            '' === $message ? '(nothing)' : $message,
        );
    }
}
