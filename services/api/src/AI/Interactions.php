<?php

declare(strict_types=1);

namespace App\AI;

use App\AI\Interfaces\AssistantInterface;
use App\AI\Model\Answer;
use App\AI\Model\Ask;
use App\AI\Model\ToolDefinition;
use App\Entity\AssistantInteraction;
use App\Enum\Actor;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psl\Vec;

final readonly class Interactions
{
    public const ANSWERED = 'answered';
    public const TOOL_CALL = 'tool_call';
    public const REFUSED = 'refused';
    public const UNAVAILABLE = 'unavailable';
    public const FAILED = 'failed';

    private const RESPONSE_LIMIT = 2000;

    public function __construct(private EntityManagerInterface $em)
    {
    }

    /** @param array{cacheable: list<string>, perRequest: list<string>} $prompt as sent */
    public function record(
        Ask $ask,
        AssistantInterface $assistant,
        array $prompt,
        string $outcome,
        ?Answer $answer = null,
    ): AssistantInteraction {
        $interaction = new AssistantInteraction(
            actorType: Actor::System,
            actorId: null,
            actorLabel: null,
            sessionId: $ask->sessionId,
            context: $ask->context->value,
            usageFeature: $ask->context->usageFeature(),
            provider: $assistant->provider(),
            model: $assistant->model(),
            locale: $ask->locale,
            outcome: $outcome,
            systemPrompt: implode("\n\n", [...$prompt['cacheable'], ...$prompt['perRequest']]),
            userPrompt: $ask->lastUserMessage(),
            resourceContext: $ask->resourceContext,
            toolsOffered: Vec\map($ask->tools, static fn (ToolDefinition $t): string => $t->name),
            toolCalled: $answer?->toolCall?->name,
            response: null === $answer?->text ? null : Str\slice($answer->text, 0, self::RESPONSE_LIMIT),
            inputTokens: $answer?->inputTokens ?? 0,
            outputTokens: $answer?->outputTokens ?? 0,
        );

        $this->em->persist($interaction);

        return $interaction;
    }

    public static function outcomeOf(Answer $answer): string
    {
        return $answer->isToolCall() ? self::TOOL_CALL : self::ANSWERED;
    }
}
