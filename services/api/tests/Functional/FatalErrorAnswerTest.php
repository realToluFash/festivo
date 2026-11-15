<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psl\Async;
use Psl\DateTime\Duration;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** FrankenPHP, not PHP's built-in server: that one never writes the error page into the response. */
final class FatalErrorAnswerTest extends TestCase
{
    private const string API = __DIR__ . '/../..';

    private const string LOG = self::API . '/var/log/test.log';

    /** @var resource|null */
    private $server;

    /** @var int<0, max> */
    private int $port = 0;

    protected function tearDown(): void
    {
        if (null === $this->server) {
            return;
        }

        \proc_terminate($this->server);
        \proc_close($this->server);
    }

    /** @return iterable<string, array{0: string, 1: string, 2: bool}> */
    public static function crashes(): iterable
    {
        yield 'out of memory, debug on' => ['/api/_crash/memory', 'Allowed memory size', true];
        yield 'past the time limit, debug on' => ['/api/_crash/time', 'Maximum execution time', true];
        yield 'out of memory, debug off' => ['/api/_crash/memory', 'Allowed memory size', false];
        yield 'past the time limit, debug off' => ['/api/_crash/time', 'Maximum execution time', false];
    }

    #[Test]
    #[DataProvider('crashes')]
    public function aCrashAnswers500InTheErrorShape(string $path, string $phpMessage, bool $debug): void
    {
        $this->serve($debug);
        [$status, $headers, $body] = $this->get($path, 'fr');

        self::assertSame(500, $status, $body);
        self::assertStringStartsWith('application/problem+json', $headers['content-type'] ?? '');
        $problem = Type\shape([
            'type' => Type\string(),
            'title' => Type\string(),
            'status' => Type\int(),
            'correlationId' => Type\string(),
        ])->coerce(Json\decode($body));
        self::assertSame('https://soirely.com/errors/internal_error', $problem['type']);
        self::assertSame(500, $problem['status']);
        self::assertSame('Une erreur s’est produite de notre côté.', $problem['title']);

        $sent = $body . Json\encode($headers);
        foreach (['Fatal error', $phpMessage, 'CrashFixtureController', '.php', ' on line '] as $leak) {
            self::assertStringNotContainsString($leak, $sent);
        }
    }

    /** The person investigating has what the client was not shown. */
    #[Test]
    #[DataProvider('crashes')]
    public function aCrashIsLoggedWithPhpsMessageAndWhere(string $path, string $phpMessage, bool $debug): void
    {
        $this->serve($debug);
        \clearstatcache();
        $before = \is_file(self::LOG) ? (int) \filesize(self::LOG) : 0;

        $this->get($path, 'en');

        $logged = (string) \file_get_contents(self::LOG, offset: $before);
        self::assertStringContainsString($phpMessage, $logged);
        self::assertMatchesRegularExpression('~ at /app/\S+\.php:\d+~', $logged);
    }

    private function serve(bool $debug): void
    {
        $this->port = self::freePort();
        $server = \proc_open(
            ['frankenphp', 'php-server', '--listen', '127.0.0.1:' . $this->port, '--root', self::API . '/public'],
            [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']],
            $pipes,
            self::API,
            [...\getenv(), 'APP_ENV' => 'test', 'APP_DEBUG' => $debug ? '1' : '0'],
        );
        self::assertIsResource($server);
        $this->server = $server;
        $this->awaitServer();
    }

    /** @return array{0: int, 1: array<string, string>, 2: string} */
    private function get(string $path, string $language): array
    {
        $context = \stream_context_create(['http' => [
            'header' => 'Accept-Language: ' . $language,
            'ignore_errors' => true,
            'timeout' => 30,
        ]]);
        $body = (string) \file_get_contents('http://127.0.0.1:' . $this->port . $path, context: $context);
        $lines = \http_get_last_response_headers() ?? [];

        $headers = [];
        foreach (Vec\drop($lines, 1) as $line) {
            $headers[Str\lowercase(Str\before($line, ':') ?? $line)] = Str\trim(Str\after($line, ':') ?? '');
        }

        return [(int) Str\split($lines[0] ?? '', ' ')[1], $headers, $body];
    }

    private function awaitServer(): void
    {
        \set_error_handler(static fn (): bool => true);

        try {
            for ($attempt = 0; $attempt < 100; ++$attempt) {
                $socket = \stream_socket_client('tcp://127.0.0.1:' . $this->port);
                if (false !== $socket) {
                    \fclose($socket);

                    return;
                }

                Async\sleep(Duration::milliseconds(50));
            }
        } finally {
            \restore_error_handler();
        }

        self::fail('the server did not start');
    }

    /** @return int<0, max> */
    private static function freePort(): int
    {
        $socket = \stream_socket_server('tcp://127.0.0.1:0');
        self::assertIsResource($socket);
        $name = (string) \stream_socket_get_name($socket, false);
        \fclose($socket);

        return Type\uint()->coerce(Str\after_last($name, ':'));
    }
}
