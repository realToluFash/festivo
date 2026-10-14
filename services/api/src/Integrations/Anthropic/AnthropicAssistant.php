<?php

declare(strict_types=1);

namespace App\Integrations\Anthropic;

use Anthropic\Client;
use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\APIException;
use Anthropic\Core\Exceptions\InternalServerException;
use Anthropic\Core\Exceptions\RateLimitException;
use Anthropic\Messages\CacheControlEphemeral;
use Anthropic\Messages\Message;
use Anthropic\Messages\MessageParam;
use Anthropic\Messages\MessageParam\Role;
use Anthropic\Messages\StopReason;
use Anthropic\Messages\TextBlock;
use Anthropic\Messages\TextBlockParam;
use Anthropic\Messages\Tool;
use Anthropic\Messages\Tool\InputSchema;
use Anthropic\Messages\ToolResultBlockParam;
use Anthropic\Messages\ToolUseBlock;
use Anthropic\Messages\ToolUseBlockParam;
use App\AI\Availability;
use App\AI\Exception\AssistantFailed;
use App\AI\Exception\AssistantRefused;
use App\AI\Exception\AssistantUnavailable;
use App\AI\Interfaces\AssistantInterface;
use App\AI\Model\Answer;
use App\AI\Model\Ask;
use App\AI\Model\ToolCall;
use App\AI\Model\ToolDefinition;
use App\AI\Model\Turn;
use App\AI\SystemPrompt;
use App\Enum\TurnRole;
use Psl\Json;
use Psl\Vec;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

final readonly class AnthropicAssistant implements AssistantInterface
{
    public function __construct(
        private Availability $availability,
        private SystemPrompt $systemPrompt,
        private LoggerInterface $logger,
        #[Autowire('%env(ASSISTANT_API_KEY)%')]
        private string $apiKey,
        #[Autowire('%env(ASSISTANT_MODEL)%')]
        private string $model,
        #[Autowire('%env(ASSISTANT_EFFORT)%')]
        private string $effort = 'medium',
        #[Autowire('%env(int:ASSISTANT_MAX_TOKENS)%')]
        private int $maxTokens = 16000,
    ) {
    }

    public function isEnabled(): bool
    {
        return $this->availability->isEnabled();
    }

    public function provider(): string
    {
        return 'anthropic';
    }

    public function model(): string
    {
        return $this->model;
    }

    public function chat(Ask $ask): Answer
    {
        $prompt = $this->systemPrompt->build($ask);

        try {
            $response = new Client(apiKey: $this->apiKey)->messages->create(
                maxTokens: $this->maxTokens,
                messages: $this->conversation($ask),
                model: $this->model,
                outputConfig: ['effort' => $this->effort],
                system: $this->system($prompt),
                thinking: ['type' => 'adaptive'],
                tools: $this->tools($ask),
            );
        } catch (RateLimitException|InternalServerException|APIConnectionException $e) {
            $this->logger->warning('Assistant provider unavailable', ['exception' => $e]);

            throw new AssistantUnavailable('The assistant is busy. Please try again.', 0, $e);
        } catch (APIException $e) {
            throw new AssistantFailed('The assistant provider rejected the request.', 0, $e);
        }

        return $this->answer($response);
    }

    private function answer(Message $response): Answer
    {
        if (StopReason::REFUSAL->value === $response->stopReason) {
            throw new AssistantRefused('The assistant would not answer that.');
        }

        $in = $response->usage->inputTokens;
        $out = $response->usage->outputTokens;

        foreach ($response->content as $block) {
            if ($block instanceof ToolUseBlock) {
                return Answer::call(
                    new ToolCall(name: $block->name, args: $block->input, callId: $block->id),
                    $in,
                    $out,
                );
            }
        }

        foreach ($response->content as $block) {
            if ($block instanceof TextBlock) {
                return Answer::text($block->text, $in, $out);
            }
        }

        throw new AssistantFailed(sprintf(
            'The assistant returned nothing usable (stop reason: %s).',
            $response->stopReason ?? 'unknown',
        ));
    }

    /**
     * @param array{cacheable: list<string>, perRequest: list<string>} $prompt
     *
     * @return list<TextBlockParam>
     */
    private function system(array $prompt): array
    {
        $blocks = [];

        foreach ($prompt['cacheable'] as $i => $text) {
            $last = $i === \count($prompt['cacheable']) - 1;

            $blocks[] = TextBlockParam::with(
                text: $text,
                cacheControl: $last ? CacheControlEphemeral::with(CacheControlEphemeral\TTL::TTL_5M) : null,
            );
        }

        foreach ($prompt['perRequest'] as $text) {
            $blocks[] = TextBlockParam::with(text: $text);
        }

        return $blocks;
    }

    /** @return list<MessageParam> */
    private function conversation(Ask $ask): array
    {
        return Vec\map($ask->conversation, static fn (Turn $turn): MessageParam => match ($turn->role) {
            TurnRole::User => MessageParam::with(content: $turn->text ?? '', role: Role::USER),
            TurnRole::Assistant => MessageParam::with(content: $turn->text ?? '', role: Role::ASSISTANT),
            TurnRole::ToolCall => MessageParam::with(
                content: [ToolUseBlockParam::with(
                    id: $turn->callId ?? '',
                    input: $turn->args ?? [],
                    name: $turn->name ?? '',
                )],
                role: Role::ASSISTANT,
            ),

            TurnRole::ToolResult => MessageParam::with(
                content: [ToolResultBlockParam::with(
                    toolUseID: $turn->callId ?? '',
                    content: Json\encode($turn->result),
                )],
                role: Role::USER,
            ),
        });
    }

    /** @return list<Tool>|null */
    private function tools(Ask $ask): ?array
    {
        if ([] === $ask->tools) {
            return null;
        }

        return Vec\map($ask->tools, static fn (ToolDefinition $tool): Tool => Tool::with(
            inputSchema: InputSchema::with(
                properties: $tool->inputSchema['properties'] ?? null,
                required: $tool->inputSchema['required'] ?? null,
            ),
            name: $tool->name,
            description: $tool->description,
        ));
    }
}
