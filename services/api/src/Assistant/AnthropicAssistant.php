<?php

declare(strict_types=1);

namespace App\Assistant;

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
use Psl\Json;
use Psl\Vec;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Anthropic, through the official SDK.
 *
 * The first adapter because it is the provider this product uses; another is
 * another class behind the same interface and a changed configuration value.
 *
 * Nothing here is stateful. One request in, one answer out — the agent loop
 * belongs to the client, which is the only side that knows what its tools can
 * do on the screen the organiser is looking at.
 */
final readonly class AnthropicAssistant implements Assistant
{
    public function __construct(
        private Availability $availability,
        private SystemPrompt $systemPrompt,
        private LoggerInterface $logger,
        #[Autowire('%env(ASSISTANT_API_KEY)%')]
        private string $apiKey,
        #[Autowire('%env(ASSISTANT_MODEL)%')]
        private string $model,
        /**
         * Medium rather than high, because somebody is waiting.
         *
         * Effort buys depth at the cost of latency and tokens, and on this
         * model the lower levels are unusually strong — so the interactive
         * default is modest and the assisted flows that need more can raise it
         * when they arrive with evidence that they do.
         */
        #[Autowire('%env(ASSISTANT_EFFORT)%')]
        private string $effort = 'medium',
        /**
         * Covers thinking AND the reply together, which is the trap: a budget
         * sized for the answer alone truncates mid-sentence once the model
         * starts thinking, and the response arrives looking like a bug in the
         * client.
         */
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
            // Busy, overloaded, or unreachable. Handled, not reported: a
            // provider under load is traffic, and paging somebody for it means
            // nobody reads the page that matters.
            $this->logger->warning('Assistant provider unavailable', ['exception' => $e]);

            throw new AssistantUnavailable('The assistant is busy. Please try again.', 0, $e);
        } catch (APIException $e) {
            // A rejected key, a malformed request, a payload we cannot read.
            // Ours.
            throw new AssistantFailed('The assistant provider rejected the request.', 0, $e);
        }

        return $this->answer($response);
    }

    private function answer(Message $response): Answer
    {
        // Checked BEFORE the content is read. A refusal arrives as a perfectly
        // successful response whose content is empty or partial, so code that
        // indexes content[0] breaks here rather than reporting the refusal.
        if (StopReason::REFUSAL->value === $response->stopReason) {
            throw new AssistantRefused('The assistant would not answer that.');
        }

        $in = $response->usage->inputTokens;
        $out = $response->usage->outputTokens;

        // A tool call outranks any text beside it: the model may narrate what
        // it is about to do, and the client's loop needs the call, not the
        // narration.
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

        // Neither text nor a call, and not a refusal either. Most often
        // max_tokens: the budget went entirely on thinking.
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

            // The breakpoint goes on the LAST cacheable block, not on the whole
            // request: automatic placement would put it after the resource
            // context, which differs every time, and write a cache entry
            // nothing ever reads.
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
            // A result is a USER turn, which reads oddly and is the protocol:
            // the client is reporting back, and the provider rejects the
            // request if the call and its result are not that pair.
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
            // Null, not an empty list. An empty tools array is a different
            // request to the provider than no tools at all, and it invalidates
            // the prompt cache for every request that does carry tools.
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
