<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\EventListener\CorrelationIdListener;
use App\EventListener\JsonExceptionListener;
use App\Http\ErrorCode;
use App\Http\Exception\ApiException;
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

        self::assertFalse($body['success']);
        self::assertSame('internal_error', $body['code']);
        self::assertStringNotContainsString('hunter2', $body['error']);
        self::assertStringNotContainsString('SQLSTATE', $body['error']);
        self::assertSame('translated:errors.internal_error', $body['error']);
    }

    #[Test]
    public function anUnhandledExceptionCarriesTheCorrelationId(): void
    {
        $body = $this->handle(new RuntimeException('boom'), correlationId: 'abc-123');

        self::assertSame('abc-123', $body['correlation_id']);
    }

    #[Test]
    public function itNeverReturnsAStackTraceOrAFilePath(): void
    {
        $body = $this->handle(new RuntimeException('boom'));

        self::assertArrayNotHasKey('trace', $body);
        self::assertArrayNotHasKey('file', $body);
        self::assertArrayNotHasKey('line', $body);
        self::assertSame(['success', 'error', 'code', 'correlation_id'], array_keys($body));
    }

    /** A 4xx describes what the caller did, so it may say so. */
    #[Test]
    public function aClientErrorKeepsItsOwnMessage(): void
    {
        $body = $this->handle(ApiException::notFound('No guest with that id.'));

        self::assertSame('not_found', $body['code']);
        self::assertSame('No guest with that id.', $body['error']);
    }

    #[Test]
    public function aClientErrorWithNoMessageFallsBackToTheCatalogue(): void
    {
        $body = $this->handle(new ApiException(ErrorCode::Forbidden));

        self::assertSame('translated:errors.forbidden', $body['error']);
    }

    #[Test]
    public function aSymfonyHttpExceptionMapsOntoARegistryCode(): void
    {
        $body = $this->handle(new NotFoundHttpException('No route found'));

        self::assertSame('not_found', $body['code']);
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

        return json_decode((string) $response->getContent(), true, 512, \JSON_THROW_ON_ERROR);
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
