<?php

declare(strict_types=1);

namespace App\Controller;

use App\Assistant\Ask;
use App\Assistant\Assistant;
use App\Assistant\AssistantContext;
use App\Assistant\AssistantFailed;
use App\Assistant\AssistantRefused;
use App\Assistant\AssistantUnavailable;
use App\Assistant\Availability;
use App\Assistant\Interactions;
use App\Assistant\SystemPrompt;
use App\Assistant\ToolDefinition;
use App\Assistant\Turn;
use App\Http\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Type;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;

/**
 * One turn of an assisted conversation, proxied.
 *
 * Proxied for the same reason the geocoder is: the provider key must never
 * reach a browser or a phone. But also because the system prompt must not —
 * a client able to set its own instructions can undo every one of ours, and
 * there is no amount of prompt wording that defends against being replaced.
 * So the client sends a context NAME and the prompt is resolved here.
 *
 * Stateless. The agent loop runs on the client: it sends the conversation and
 * the tools it can run, and gets back either text to show or one tool to run
 * and come back with. The server holds no session, which means a dropped
 * connection loses a turn rather than a conversation.
 */
final class AssistantController
{
    /**
     * Keys a client must not be able to set, refused rather than ignored.
     *
     * Dropping them silently would be safe and unhelpful: a client that thinks
     * it set the system prompt and was quietly overruled has no way to find
     * that out, and would eventually ship a feature built on the assumption.
     */
    private const FORBIDDEN = ['system', 'systemPrompt', 'system_prompt', 'instructions'];

    public function __construct(
        private readonly Assistant $assistant,
        private readonly Availability $availability,
        private readonly SystemPrompt $systemPrompt,
        private readonly Interactions $interactions,
        private readonly EntityManagerInterface $em,
        private readonly LoggerInterface $logger,
        private readonly RateLimiterFactoryInterface $assistantChatLimiter,
    ) {
    }

    #[Route('/api/assistant/chat', name: 'assistant_chat', methods: ['POST'])]
    public function chat(Request $request): JsonResponse
    {
        $this->limit($request);

        // Asked first, before the body is even read. Whether the feature exists
        // here is not a property of the request.
        if (!$this->assistant->isEnabled()) {
            $this->logger->info('Assistant turn refused: {reason}', [
                'reason' => $this->availability->unavailableReason() ?? 'unknown',
            ]);

            throw new ApiException(
                ErrorCode::AssistantUnavailable,
                'The assistant is not available.',
            );
        }

        $ask = $this->ask($request);
        $prompt = $this->systemPrompt->build($ask);

        try {
            $answer = $this->assistant->chat($ask);
        } catch (AssistantUnavailable $e) {
            throw $this->recordAndRethrow(
                $ask,
                $prompt,
                Interactions::UNAVAILABLE,
                new ApiException(ErrorCode::AssistantBusy, 'The assistant is busy. Please try again.', [], $e),
            );
        } catch (AssistantRefused $e) {
            throw $this->recordAndRethrow(
                $ask,
                $prompt,
                Interactions::REFUSED,
                new ApiException(ErrorCode::AssistantRefused, 'The assistant would not answer that.', [], $e),
            );
        } catch (AssistantFailed $e) {
            // Ours. Recorded, logged at error, and answered generically — the
            // envelope must not carry a provider's message to a client.
            $this->logger->error('Assistant turn failed', ['exception' => $e]);

            throw $this->recordAndRethrow(
                $ask,
                $prompt,
                Interactions::FAILED,
                new ApiException(ErrorCode::InternalError, 'The assistant could not answer.', [], $e),
            );
        }

        $this->interactions->record($ask, $this->assistant, $prompt, Interactions::outcomeOf($answer), $answer);
        $this->em->flush();

        return new JsonResponse([
            'success' => true,
            'data' => [
                'text' => $answer->text,
                'toolCall' => null === $answer->toolCall ? null : [
                    'name' => $answer->toolCall->name,
                    'args' => $answer->toolCall->args,
                    'callId' => $answer->toolCall->callId,
                ],
                'usage' => [
                    'inputTokens' => $answer->inputTokens,
                    'outputTokens' => $answer->outputTokens,
                ],
            ],
        ]);
    }

    /**
     * The request, as something typed.
     *
     * The shape is OPEN here, uniquely in this codebase, because the forbidden
     * keys have to be SEEN to be refused — a closed shape drops them, which is
     * safe and silent. Declared keys are read by name below; nothing reads the
     * rest.
     */
    private function ask(Request $request): Ask
    {
        $body = Input::body($request, Type\shape([
            'context' => Type\string(),
            'messages' => Type\vec(Type\shape([
                'role' => Type\string(),
                'content' => Type\optional(Type\nullable(Type\string())),
                'callId' => Type\optional(Type\nullable(Type\string())),
                'name' => Type\optional(Type\nullable(Type\string())),
                'args' => Type\optional(Type\nullable(Type\dict(Type\string(), Type\mixed()))),
                'result' => Type\optional(Type\mixed()),
            ], allowUnknownFields: true)),
            'tools' => Type\optional(Type\vec(Type\shape([
                'name' => Type\string(),
                'description' => Type\optional(Type\string()),
                'inputSchema' => Type\optional(Type\dict(Type\string(), Type\mixed())),
            ], allowUnknownFields: true))),
            'resourceContext' => Type\optional(Type\nullable(Type\string())),
            'sessionId' => Type\optional(Type\nullable(Type\string())),
        ], allowUnknownFields: true));

        foreach (self::FORBIDDEN as $key) {
            if (\array_key_exists($key, $body)) {
                throw new ApiException(ErrorCode::BadRequest, sprintf(
                    'The system prompt is resolved by the server and cannot be set by a client. Remove "%s" and send a "context" instead.',
                    $key,
                ));
            }
        }

        $context = AssistantContext::tryFrom($body['context']);
        if (null === $context) {
            // Named, and the alternatives listed. An unknown context silently
            // falling back to a default would answer the wrong question
            // convincingly.
            throw new ApiException(ErrorCode::BadRequest, sprintf(
                'Unknown assistant context "%s". Known contexts: %s.',
                $body['context'],
                implode(', ', array_column(AssistantContext::cases(), 'value')),
            ));
        }

        return new Ask(
            context: $context,
            conversation: array_map($this->turn(...), $body['messages']),
            tools: array_map(
                static fn (array $t): ToolDefinition => new ToolDefinition(
                    name: $t['name'],
                    description: $t['description'] ?? '',
                    inputSchema: $t['inputSchema'] ?? [],
                ),
                $body['tools'] ?? [],
            ),
            // Resolved by RequestLocaleListener from the explicit parameter, the
            // account preference or Accept-Language — not taken from the body,
            // so the assistant answers in the same language as every error
            // beside it.
            locale: $request->getLocale(),
            resourceContext: $body['resourceContext'] ?? null,
            sessionId: $body['sessionId'] ?? null,
        );
    }

    /** @param array<string, mixed> $message */
    private function turn(array $message): Turn
    {
        /** @var string $role */
        $role = $message['role'];

        return match ($role) {
            'user' => Turn::user(Type\string()->coerce($message['content'] ?? '')),
            'assistant' => Turn::assistant(Type\string()->coerce($message['content'] ?? '')),
            'tool_call' => Turn::toolCall(
                Type\string()->coerce($message['callId'] ?? ''),
                Type\string()->coerce($message['name'] ?? ''),
                Type\dict(Type\string(), Type\mixed())->coerce($message['args'] ?? []),
            ),
            'tool_result' => Turn::toolResult(
                Type\string()->coerce($message['callId'] ?? ''),
                $message['result'] ?? null,
            ),
            default => throw new ApiException(ErrorCode::BadRequest, sprintf(
                'Unknown message role "%s". Known roles: user, assistant, tool_call, tool_result.',
                $role,
            )),
        };
    }

    /**
     * Record the attempt, flush it, and hand back the exception to throw.
     *
     * Flushed here rather than left to the caller, because the record is the
     * only trace a failed turn leaves and an exception on the way out would
     * otherwise discard it.
     *
     * @param array{cacheable: list<string>, perRequest: list<string>} $prompt
     */
    private function recordAndRethrow(Ask $ask, array $prompt, string $outcome, ApiException $e): ApiException
    {
        $this->interactions->record($ask, $this->assistant, $prompt, $outcome);
        $this->em->flush();

        return $e;
    }

    private function limit(Request $request): void
    {
        // Per IP until there are accounts, at which point this becomes the
        // authenticated organiser — a per-IP budget is shared by everybody
        // behind one office connection.
        $limiter = $this->assistantChatLimiter->create($request->getClientIp() ?? 'anonymous');

        if (!$limiter->consume()->isAccepted()) {
            throw new ApiException(
                ErrorCode::TooManyRequests,
                'Too many assistant requests. Please wait a moment.',
            );
        }
    }
}
