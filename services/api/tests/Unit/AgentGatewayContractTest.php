<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\AI\Availability;
use App\AI\Exception\AssistantFailed;
use App\AI\Exception\AssistantRefused;
use App\AI\Exception\AssistantUnavailable;
use App\AI\Model\Answer;
use App\AI\Model\Ask;
use App\AI\Model\Turn;
use App\AI\SystemPrompt;
use App\Enum\AssistantContext;
use App\Integrations\Anthropic\AnthropicAssistant;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Async;
use Psl\DateTime\Duration;
use Psl\File;
use Psl\Filesystem;
use Psl\Str;
use Psl\TCP;
use Psr\Log\NullLogger;
use RuntimeException;
use Symfony\Component\Clock\MockClock;
use Throwable;

final class AgentGatewayContractTest extends TestCase
{
    /** @var resource|null */
    private static $server;

    private static int $port;

    /** @var non-empty-string */
    private static string $log;

    public static function setUpBeforeClass(): void
    {
        $listener = TCP\listen('127.0.0.1');
        self::$port = $listener->getLocalAddress()->port ?? throw new RuntimeException('No free port.');
        $listener->close();

        $router = \dirname(__DIR__) . '/Fixtures/AgentGateway/replay.php';
        self::$log = Filesystem\create_temporary_file(prefix: 'agent-gateway-replay-');
        self::$server = \proc_open(
            ['php', '-S', '127.0.0.1:' . self::$port, $router],
            [1 => ['file', '/dev/null', 'w'], 2 => ['file', self::$log, 'w']],
            $pipes,
        ) ?: throw new RuntimeException('The replay server did not start.');

        for ($i = 0; $i < 100; ++$i) {
            if (Str\contains(File\read(self::$log), 'started')) {
                return;
            }

            Async\sleep(Duration::milliseconds(100));
        }

        throw new RuntimeException('The replay server is not listening.');
    }

    public static function tearDownAfterClass(): void
    {
        if (null !== self::$server) {
            \proc_terminate(self::$server);
            \proc_close(self::$server);
        }

        Filesystem\delete_file(self::$log);
    }

    protected function tearDown(): void
    {
        unset($_ENV['ANTHROPIC_BASE_URL']);
    }

    /** @return iterable<string, array{string, class-string<Throwable>|null}> */
    public static function pairs(): iterable
    {
        yield 'text' => ['text', null];
        yield 'tool use' => ['tool_use', null];
        yield 'tool result sent back' => ['tool_result', null];
        yield 'max tokens' => ['max_tokens', null];
        yield 'refusal' => ['refusal', AssistantRefused::class];
        yield 'malformed request, 400' => ['malformed', AssistantFailed::class];
        yield 'streaming asked for, 400' => ['stream', AssistantFailed::class];
        yield 'wrong key, 401' => ['authentication', AssistantFailed::class];
        yield 'worker failed, 500' => ['worker_failed', AssistantUnavailable::class];
        yield 'pool full, 529' => ['overloaded', AssistantUnavailable::class];
    }

    /** @param class-string<Throwable>|null $throws */
    #[Test]
    #[DataProvider('pairs')]
    public function theGatewaysAnswerBecomesWhatAnthropicsWould(string $pair, ?string $throws): void
    {
        $fromAnthropic = $this->outcome($pair, 'anthropic');
        $fromGateway = $this->outcome($pair, 'gateway');

        if (null !== $throws) {
            self::assertInstanceOf($throws, $fromAnthropic);
            self::assertInstanceOf($throws, $fromGateway);

            return;
        }

        self::assertInstanceOf(Answer::class, $fromAnthropic);
        self::assertInstanceOf(Answer::class, $fromGateway);
        self::assertSame($fromAnthropic->isToolCall(), $fromGateway->isToolCall());
        self::assertSame($fromAnthropic->toolCall?->name, $fromGateway->toolCall?->name);
        self::assertSame($fromAnthropic->toolCall?->args, $fromGateway->toolCall?->args);
        self::assertSame(null === $fromAnthropic->text, null === $fromGateway->text);
        self::assertGreaterThan(0, $fromGateway->inputTokens);
        self::assertGreaterThan(0, $fromGateway->outputTokens);
    }

    #[Test]
    public function aToolCallKeepsTheGatewaysCallId(): void
    {
        $answer = $this->outcome('tool_use', 'gateway');

        self::assertInstanceOf(Answer::class, $answer);
        self::assertStringStartsWith('toolu_', (string) $answer->toolCall?->callId);
    }

    private function outcome(string $pair, string $side): Answer|Throwable
    {
        $_ENV['ANTHROPIC_BASE_URL'] = Str\format('http://127.0.0.1:%d/%s/%s', self::$port, $pair, $side);

        $assistant = new AnthropicAssistant(
            new Availability('anthropic', 'sk-synthetic', true),
            new SystemPrompt(new MockClock('2026-10-21 09:00:00')),
            new NullLogger(),
            'sk-synthetic',
            'claude-opus-5-5',
        );

        try {
            return $assistant->chat(new Ask(AssistantContext::cases()[0], [Turn::user('How many said yes?')]));
        } catch (Throwable $e) {
            return $e;
        }
    }
}
