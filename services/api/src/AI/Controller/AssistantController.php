<?php

declare(strict_types=1);

namespace App\AI\Controller;

use App\AI\Availability;
use App\AI\Exception\AssistantFailed;
use App\AI\Exception\AssistantRefused;
use App\AI\Exception\AssistantUnavailable;
use App\AI\InteractionRecorder;
use App\AI\Interfaces\AssistantInterface;
use App\AI\Model\Ask;
use App\AI\Model\ToolDefinition;
use App\AI\Model\Turn;
use App\AI\SystemPrompt;
use App\Enum\AssistantContext;
use App\Enum\ErrorCode;
use App\Http\Access\Policy\PublicAccess;
use App\Http\Exception\ApiException;
use App\Http\Input;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;
use Symfony\Component\Routing\Attribute\Route;

#[PublicAccess]
final class AssistantController
{
    private const FORBIDDEN = ['system', 'systemPrompt', 'system_prompt', 'instructions'];

    private const MAX_RESOURCE_CONTEXT = 16384;
    private const MAX_MESSAGES = 200;
    private const MAX_TOOLS = 64;

    public function __construct(
        private readonly AssistantInterface $assistant,
        private readonly Availability $availability,
        private readonly SystemPrompt $systemPrompt,
        private readonly InteractionRecorder $interactions,
        private readonly EntityManagerInterface $entityManager,
        private readonly LoggerInterface $logger,
        private readonly RateLimiterFactoryInterface $assistantChatLimiter,
    ) {
    }

    #[Route('/api/assistant/chat', name: 'assistant_chat', methods: ['POST'])]
    public function chat(Request $request): JsonResponse
    {
        $this->limit($request);

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
                InteractionRecorder::UNAVAILABLE,
                new ApiException(ErrorCode::AssistantBusy, 'The assistant is busy. Please try again.', [], $e),
            );
        } catch (AssistantRefused $e) {
            throw $this->recordAndRethrow(
                $ask,
                $prompt,
                InteractionRecorder::REFUSED,
                new ApiException(ErrorCode::AssistantRefused, 'The assistant would not answer that.', [], $e),
            );
        } catch (AssistantFailed $e) {
            $this->logger->error('Assistant turn failed', ['exception' => $e]);

            throw $this->recordAndRethrow(
                $ask,
                $prompt,
                InteractionRecorder::FAILED,
                new ApiException(ErrorCode::InternalError, 'The assistant could not answer.', [], $e),
            );
        }

        $this->interactions->record($ask, $this->assistant, $prompt, InteractionRecorder::outcomeOf($answer), $answer);
        $this->entityManager->flush();

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
                throw new ApiException(ErrorCode::BadRequest, \sprintf(
                    'The system prompt is resolved by the server and cannot be set by a client. Remove "%s" and send a "context" instead.',
                    $key,
                ));
            }
        }

        $this->refuseOversized($body);

        $context = AssistantContext::tryFrom($body['context']);
        if (null === $context) {
            throw new ApiException(ErrorCode::BadRequest, \sprintf(
                'Unknown assistant context "%s". Known contexts: %s.',
                $body['context'],
                Str\join(Vec\map(AssistantContext::cases(), static fn (AssistantContext $c): string => $c->value), ', '),
            ));
        }

        return new Ask(
            context: $context,
            conversation: \array_map($this->turn(...), $body['messages']),
            tools: \array_map(
                static fn (array $t): ToolDefinition => new ToolDefinition(
                    name: $t['name'],
                    description: $t['description'] ?? '',
                    inputSchema: $t['inputSchema'] ?? [],
                ),
                $body['tools'] ?? [],
            ),
            locale: $request->getLocale(),
            resourceContext: $body['resourceContext'] ?? null,
            sessionId: $body['sessionId'] ?? null,
        );
    }

    /** @param array<string, mixed> $body */
    private function refuseOversized(array $body): void
    {
        $oversized = [];

        if (\count($body['messages']) > self::MAX_MESSAGES) {
            $oversized['messages'] = \sprintf(
                'A conversation may carry at most %d turns; this one has %d. Compact the history before sending it.',
                self::MAX_MESSAGES,
                \count($body['messages']),
            );
        }

        if (\count($body['tools'] ?? []) > self::MAX_TOOLS) {
            $oversized['tools'] = \sprintf(
                'At most %d tools may be offered; this request offers %d.',
                self::MAX_TOOLS,
                \count($body['tools'] ?? []),
            );
        }

        $resourceContext = $body['resourceContext'] ?? null;
        if (null !== $resourceContext && \mb_strlen($resourceContext) > self::MAX_RESOURCE_CONTEXT) {
            $oversized['resourceContext'] = \sprintf(
                'The resource context may be at most %d characters; this one is %d. Send what is on the screen, not the whole record.',
                self::MAX_RESOURCE_CONTEXT,
                \mb_strlen($resourceContext),
            );
        }

        if ([] === $oversized) {
            return;
        }

        throw ApiException::validation(
            \array_map(
                static fn (string $path, string $message): array => [
                    'propertyPath' => $path,
                    'message' => $message,
                    'code' => 'too_large',
                ],
                \array_keys($oversized),
                \array_values($oversized),
            ),
            'The request is larger than the assistant accepts.',
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
            default => throw new ApiException(ErrorCode::BadRequest, \sprintf(
                'Unknown message role "%s". Known roles: user, assistant, tool_call, tool_result.',
                $role,
            )),
        };
    }

    /** @param array{cacheable: list<string>, perRequest: list<string>} $prompt */
    private function recordAndRethrow(Ask $ask, array $prompt, string $outcome, ApiException $e): ApiException
    {
        $this->interactions->record($ask, $this->assistant, $prompt, $outcome);
        $this->entityManager->flush();

        return $e;
    }

    private function limit(Request $request): void
    {
        $limiter = $this->assistantChatLimiter->create($request->getClientIp() ?? 'anonymous');

        if (!$limiter->consume()->isAccepted()) {
            throw new ApiException(
                ErrorCode::TooManyRequests,
                'Too many assistant requests. Please wait a moment.',
            );
        }
    }
}
