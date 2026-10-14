<?php

declare(strict_types=1);

namespace App\AI;

use App\AI\Exception\AssistantFailed;
use App\AI\Exception\AssistantRefused;
use App\AI\Exception\AssistantUnavailable;
use App\AI\Interfaces\AssistantInterface;
use App\AI\Model\Answer;
use App\AI\Model\Ask;
use App\AI\Model\ToolCall;
use Psl\Str;

final readonly class ScriptedAssistant implements AssistantInterface
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
            throw new AssistantFailed(sprintf(
                'No tool to call: the request offered %s.',
                [] === $ask->tools ? 'none' : sprintf('%d, none named "%s"', \count($ask->tools), $name),
            ));
        }

        return Answer::call(new ToolCall(
            name: $tool->name,
            args: [],
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
