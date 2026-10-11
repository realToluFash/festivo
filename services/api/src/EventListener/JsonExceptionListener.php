<?php

declare(strict_types=1);

namespace App\EventListener;

use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * An API answers in JSON, including when it is failing.
 *
 * Symfony's default is an HTML error page, which a mobile client parses as
 * nothing at all — so the one case a client most needs to understand is the one
 * it cannot read. This applies in every environment: dev included, because a
 * client developed against HTML errors has never had its error path exercised.
 *
 * sc-46 formalises the full contract. This establishes only that the shape is
 * JSON and that nothing internal escapes.
 */
#[AsEventListener(event: KernelEvents::EXCEPTION, priority: -64)]
final readonly class JsonExceptionListener
{
    public function __construct(private LoggerInterface $logger)
    {
    }

    public function __invoke(ExceptionEvent $event): void
    {
        $request = $event->getRequest();

        if (!str_starts_with($request->getPathInfo(), '/api')) {
            return;
        }

        $e = $event->getThrowable();
        $isHttp = $e instanceof HttpExceptionInterface;
        $status = $isHttp ? $e->getStatusCode() : 500;

        if ($status >= 500) {
            $this->logger->error($e->getMessage(), ['exception' => $e]);
        }

        // A 4xx carries its own message because it describes what the caller
        // did. A 5xx never does: the message is ours, and it routinely quotes
        // a query, a path or a DSN.
        $message = $isHttp && $status < 500
            ? ($e->getMessage() ?: 'Request could not be processed.')
            : 'Something went wrong on our side.';

        $body = [
            'success' => false,
            'error' => $message,
            'code' => $isHttp ? $this->codeFor($status) : 'internal_error',
        ];

        $correlationId = $request->attributes->get(CorrelationIdListener::ATTRIBUTE);
        if (is_string($correlationId)) {
            $body['correlation_id'] = $correlationId;
        }

        $event->setResponse(new JsonResponse($body, $status));
    }

    private function codeFor(int $status): string
    {
        return match ($status) {
            400 => 'bad_request',
            401 => 'unauthenticated',
            403 => 'forbidden',
            404 => 'not_found',
            405 => 'method_not_allowed',
            409 => 'conflict',
            422 => 'validation_failed',
            429 => 'too_many_requests',
            default => 'request_failed',
        };
    }
}
