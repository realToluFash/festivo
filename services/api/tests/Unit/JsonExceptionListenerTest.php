<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\Listener\CorrelationIdListener;
use App\Http\Listener\JsonExceptionListener;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use RuntimeException;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\HttpKernelInterface;
use Symfony\Contracts\Translation\TranslatorInterface;
use Throwable;

final class JsonExceptionListenerTest extends TestCase
{
    /**
     * The message on a 5xx is ours. It routinely quotes a query, a file path or
     * a connection string, and this response goes to whoever asked.
     */
    #[Test]
    public function anUnhandledExceptionNeverReturnsItsOwnMessage(): void
    {
        $leaky = new RuntimeException('SQLSTATE[08006] pgsql://soirely:hunter2@postgres:5432');
        $body = $this->handle($leaky);

        self::assertSame('https://soirely.com/errors/internal_error', $body['type']);
        self::assertSame(500, $body['status']);
        self::assertSame('translated:internal_error', $body['title']);
        // detail is the specific instance of a problem, and on a 5xx there is
        // nothing safe to put there.
        self::assertArrayNotHasKey('detail', $body);
        self::assertStringNotContainsString('hunter2', \json_encode($body, \JSON_THROW_ON_ERROR));
        self::assertStringNotContainsString('SQLSTATE', \json_encode($body, \JSON_THROW_ON_ERROR));
    }

    #[Test]
    public function anUnhandledExceptionCarriesTheCorrelationId(): void
    {
        $body = $this->handle(new RuntimeException('boom'), correlationId: 'abc-123');

        self::assertSame('abc-123', $body['correlationId']);
    }

    #[Test]
    public function itNeverReturnsAStackTraceOrAFilePath(): void
    {
        $body = $this->handle(new RuntimeException('boom'));

        self::assertArrayNotHasKey('trace', $body);
        self::assertArrayNotHasKey('file', $body);
        self::assertArrayNotHasKey('line', $body);
        self::assertSame(['type', 'title', 'status', 'correlationId'], \array_keys($body));
    }

    /** A 4xx describes what the caller did, so it may say so. */
    #[Test]
    public function aClientErrorKeepsItsOwnMessage(): void
    {
        $body = $this->handle(ApiException::notFound('No guest with that id.'));

        self::assertSame('https://soirely.com/errors/not_found', $body['type']);
        self::assertSame('No guest with that id.', $body['detail']);
    }

    #[Test]
    public function aClientErrorWithNoMessageFallsBackToTheCatalogue(): void
    {
        $body = $this->handle(new ApiException(ErrorCode::Forbidden));

        self::assertSame('translated:forbidden', $body['title']);
        self::assertArrayNotHasKey('detail', $body);
    }

    #[Test]
    public function aSymfonyHttpExceptionMapsOntoARegistryCode(): void
    {
        $body = $this->handle(new NotFoundHttpException('No route found'));

        self::assertSame('https://soirely.com/errors/not_found', $body['type']);
        self::assertSame(404, $body['status']);
    }

    /** Only /api is ours to reshape; anything else keeps Symfony's behaviour. */
    #[Test]
    public function itLeavesNonApiPathsAlone(): void
    {
        $event = $this->event(new RuntimeException('boom'), path: '/some-page');
        ($this->listener())($event);

        self::assertNull($event->getResponse());
    }

    /** @return array<string, mixed> */
    private function handle(Throwable $e, string $correlationId = 'cid'): array
    {
        $event = $this->event($e, correlationId: $correlationId);
        ($this->listener())($event);

        $response = $event->getResponse();
        self::assertNotNull($response);

        return \json_decode((string) $response->getContent(), true, 512, \JSON_THROW_ON_ERROR);
    }

    private function event(Throwable $e, string $path = '/api/thing', string $correlationId = 'cid'): ExceptionEvent
    {
        $request = Request::create($path);
        $request->attributes->set(CorrelationIdListener::ATTRIBUTE, $correlationId);

        return new ExceptionEvent(
            $this->createMock(HttpKernelInterface::class),
            $request,
            HttpKernelInterface::MAIN_REQUEST,
            $e,
        );
    }

    private function listener(): JsonExceptionListener
    {
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnCallback(
            static fn (string $id): string => 'translated:' . $id,
        );

        return new JsonExceptionListener(new NullLogger(), $translator);
    }
}
