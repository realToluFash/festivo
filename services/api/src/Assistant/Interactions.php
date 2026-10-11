<?php

declare(strict_types=1);

namespace App\Assistant;

use App\Audit\Actor;
use App\Entity\AssistantInteraction;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psl\Vec;

/**
 * Recording a turn is one call.
 *
 * Not something each assisted flow reimplements. The same reasoning as the
 * auditor: a path that has to remember to record is a path that will forget,
 * and the ones that get forgotten are the interesting ones because they were
 * written carefully and separately.
 *
 * Persists but does not flush. The caller flushes — including on the failure
 * paths, where the record is the only trace that the turn happened at all.
 */
final readonly class Interactions
{
    /** Outcomes, so a query does not depend on a spelling at a call site. */
    public const ANSWERED = 'answered';
    public const TOOL_CALL = 'tool_call';
    public const REFUSED = 'refused';
    public const UNAVAILABLE = 'unavailable';
    public const FAILED = 'failed';

    /**
     * Enough of the reply to tell what it said, not the whole of a long one.
     *
     * A row that holds a full essay is a row nobody scans, and the question
     * being answered — what did it tell them — is answered by the opening.
     */
    private const RESPONSE_LIMIT = 2000;

    public function __construct(private EntityManagerInterface $em)
    {
    }

    /**
     * @param array{cacheable: list<string>, perRequest: list<string>} $prompt as sent
     */
    public function record(
        Ask $ask,
        Assistant $assistant,
        array $prompt,
        string $outcome,
        ?Answer $answer = null,
    ): AssistantInteraction {
        $interaction = new AssistantInteraction(
            // The system until there are accounts. Accounts & sign-in replaces
            // this with the authenticated organiser; the columns are already
            // here so that change is a line in this method and not a migration.
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
