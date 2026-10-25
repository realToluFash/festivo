<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\Exception\ShapeRefusal;
use App\Http\Listener\CorrelationIdListener;
use App\Http\Listener\JsonExceptionListener;
use App\Http\ProblemRenderer;
use DateTimeImmutable;
use DateTimeZone;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use RuntimeException;
use stdClass;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\UnsupportedMediaTypeHttpException;
use Symfony\Component\HttpKernel\HttpKernelInterface;
use Symfony\Component\Translation\Loader\ArrayLoader;
use Symfony\Component\Translation\Translator;
use Symfony\Component\Validator\ConstraintViolation;
use Symfony\Component\Validator\ConstraintViolationList;
use Symfony\Component\Validator\Exception\ValidationFailedException;
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
    public function aValidationFailureWithNoMessageIsDetailedByItsFirstViolation(): void
    {
        $body = $this->handle(ApiException::validation([
            ['propertyPath' => 'timezone', 'message' => 'Choose one from the list.', 'code' => 'validation_failed'],
            ['propertyPath' => 'locale', 'message' => 'Choose a language.', 'code' => 'validation_failed'],
        ]));

        self::assertSame(422, $body['status']);
        self::assertSame('Choose one from the list.', $body['detail']);
    }

    #[Test]
    public function aValidationFailureKeepsItsOwnMessage(): void
    {
        $body = $this->handle(ApiException::validation(
            [['propertyPath' => 'name', 'message' => 'Too long.', 'code' => 'invalid_shape']],
            'The request does not have the expected shape.',
        ));

        self::assertSame('The request does not have the expected shape.', $body['detail']);
    }

    #[Test]
    public function aRefusalsKeyIsWordedWithItsSlots(): void
    {
        $translator = $this->createMock(TranslatorInterface::class);
        $translator->method('trans')->willReturnCallback(
            static fn (string $id, array $parameters = []): string => $id . \json_encode($parameters, \JSON_THROW_ON_ERROR),
        );
        $event = $this->event(ApiException::tooManyAttempts('limits.tries', new DateTimeImmutable('2026-10-25 14:34:10 UTC')));
        new JsonExceptionListener(new NullLogger(), new ProblemRenderer($translator))($event);

        $body = \json_decode((string) $event->getResponse()?->getContent(), true, 512, \JSON_THROW_ON_ERROR);

        self::assertSame('limits.tries{"{time}":"14:35 UTC","{hour}":14}', $body['detail']);
    }

    /** es and pt agree the article with the hour: "a la 01:05", "a las 13:05" (sc-11332). */
    #[Test]
    public function aTryAgainTimeGivesAnIcuKeyItsHourToAgreeWith(): void
    {
        $translator = new Translator('es');
        $translator->addLoader('array', new ArrayLoader());
        $translator->addResource('array', ['limits.tries' => '{hour, plural, =1 {a la {time}} other {a las {time}}}'], 'es', 'messages+intl-icu');

        $worded = fn (string $windowEnd): mixed => $this->handleWith(ApiException::tooManyAttempts('limits.tries', new DateTimeImmutable($windowEnd)), $translator)['detail'];

        self::assertSame('a la 01:05 UTC', $worded('2026-10-25 01:04:10 UTC'));
        self::assertSame('a las 13:05 UTC', $worded('2026-10-25 13:04:10 UTC'));
    }

    /** sc-11329: a limit hit signed out has no account to take a zone from, so every reader is given UTC. */
    #[Test]
    public function aTryAgainMinuteIsUtcWhateverZoneTheWindowEndsIn(): void
    {
        $refusal = ApiException::tooManyAttempts('limits.sign_in', new DateTimeImmutable('2026-10-25 08:38:10', new DateTimeZone('Africa/Lagos')));

        self::assertSame(['{time}' => '07:39 UTC', '{hour}' => 7], $refusal->parameters);
    }

    #[Test]
    public function aShapeRefusalIsWordedThroughTheCatalogueNeverByTheParser(): void
    {
        $body = $this->handle(new ShapeRefusal('countryCode', 'validation.country_invalid'));

        self::assertSame(422, $body['status']);
        self::assertSame('translated:validation.request_shape', $body['detail']);
        self::assertSame(
            [['propertyPath' => 'countryCode', 'message' => 'translated:validation.country_invalid', 'code' => 'invalid_shape']],
            $body['violations'],
        );
    }

    /** Symfony writes the whole violation list, class names and all, as the exception's message. */
    #[Test]
    public function aSymfonyValidationFailureIsDetailedByItsFirstViolationNotItsMessage(): void
    {
        $violations = new ConstraintViolationList([
            new ConstraintViolation('This value is too long.', null, [], new stdClass(), 'name', 'x'),
            new ConstraintViolation('This value is not valid.', null, [], new stdClass(), 'email', 'y'),
        ]);

        $body = $this->handle(new ValidationFailedException(new stdClass(), $violations));

        self::assertSame(422, $body['status']);
        self::assertSame('This value is too long.', $body['detail']);
        self::assertSame('name', $body['violations'][0]['propertyPath']);
    }

    #[Test]
    public function aSymfonyHttpExceptionMapsOntoARegistryCode(): void
    {
        $body = $this->handle(new NotFoundHttpException('No route found'));

        self::assertSame('https://soirely.com/errors/not_found', $body['type']);
        self::assertSame(404, $body['status']);
        self::assertSame('translated:access.not_found', $body['detail']);
    }

    #[Test]
    public function aRefusedMethodIsNamedInACatalogueSentenceNeverTheRoutersMessage(): void
    {
        $body = $this->handle(new MethodNotAllowedHttpException(['GET', 'POST'], 'No route found for "PUT http://localhost/api/orgs": Method Not Allowed'));

        self::assertSame(405, $body['status']);
        self::assertSame('translated:request.method_not_accepted', $body['detail']);
    }

    #[Test]
    public function anyOtherFrameworkRefusalIsDetailedByItsTitle(): void
    {
        $body = $this->handle(new UnsupportedMediaTypeHttpException('Unsupported format "xml".'));

        self::assertSame($body['title'], $body['detail']);
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

    /** @return array<string, mixed> */
    private function handleWith(Throwable $e, TranslatorInterface $translator): array
    {
        $event = $this->event($e);
        new JsonExceptionListener(new NullLogger(), new ProblemRenderer($translator))($event);

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

        return new JsonExceptionListener(new NullLogger(), new ProblemRenderer($translator));
    }
}
