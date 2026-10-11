<?php

declare(strict_types=1);

namespace App\EventListener;

use App\Http\ApiResponse;
use App\Http\ErrorCode;
use App\Http\Exception\ApiException;
use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Validator\Exception\ValidationFailedException;
use Symfony\Contracts\Translation\TranslatorInterface;
use Throwable;

/**
 * Turns anything thrown under /api into the envelope.
 *
 * Runs in every environment, dev included. A client developed against HTML
 * error pages has never had its error path exercised, and finds out in
 * production.
 */
#[AsEventListener(event: KernelEvents::EXCEPTION, priority: -64)]
final readonly class JsonExceptionListener
{
    public function __construct(
        private LoggerInterface $logger,
        private TranslatorInterface $translator,
    ) {
    }

    public function __invoke(ExceptionEvent $event): void
    {
        $request = $event->getRequest();

        if (!str_starts_with($request->getPathInfo(), '/api')) {
            return;
        }

        $e = $event->getThrowable();
        [$code, $fields] = $this->classify($e);

        if ($code->status() >= 500) {
            $this->logger->error($e->getMessage(), ['exception' => $e]);
        }

        $correlationId = $request->attributes->get(CorrelationIdListener::ATTRIBUTE);

        $event->setResponse(ApiResponse::error(
            $code,
            $this->message($e, $code),
            $fields,
            is_string($correlationId) ? $correlationId : null,
        ));
    }

    /**
     * @return array{0: ErrorCode, 1: array<string, array{code: string, message: string}>}
     */
    private function classify(Throwable $e): array
    {
        if ($e instanceof ApiException) {
            return [$e->errorCode, $e->fields];
        }

        if ($e instanceof ValidationFailedException) {
            return [ErrorCode::ValidationFailed, $this->fieldsFrom($e)];
        }

        if ($e instanceof HttpExceptionInterface) {
            return [ErrorCode::forStatus($e->getStatusCode()), []];
        }

        return [ErrorCode::InternalError, []];
    }

    /**
     * @return array<string, array{code: string, message: string}>
     */
    private function fieldsFrom(ValidationFailedException $e): array
    {
        $fields = [];
        foreach ($e->getViolations() as $violation) {
            $path = $violation->getPropertyPath() ?: '_';
            // First violation per field wins. A form that marks one input with
            // four stacked messages is not more helpful than one.
            $fields[$path] ??= [
                'code' => (string) $violation->getCode(),
                'message' => (string) $violation->getMessage(),
            ];
        }

        return $fields;
    }

    /**
     * The caller's own mistake can be described. Ours cannot.
     *
     * A 5xx message is written by us and routinely quotes a query, a file path
     * or a DSN. It goes to the log; the caller gets the catalogue's wording and
     * the correlation id that ties the two together.
     */
    private function message(Throwable $e, ErrorCode $code): string
    {
        if ($code->status() < 500 && '' !== $e->getMessage()) {
            return $e->getMessage();
        }

        return $this->translator->trans($code->translationKey(), [], 'errors');
    }
}
