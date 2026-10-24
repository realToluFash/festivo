<?php

declare(strict_types=1);

namespace App\Http\Listener;

use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Http\Exception\ShapeRefusal;
use App\Http\ProblemRenderer;
use App\Locale\Listener\RequestLocaleListener;
use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Validator\Exception\ValidationFailedException;
use Symfony\Contracts\Translation\TranslatorInterface;
use Throwable;

#[AsEventListener(event: KernelEvents::EXCEPTION, priority: -64)]
final readonly class JsonExceptionListener
{
    public function __construct(
        private LoggerInterface $logger,
        private ProblemRenderer $problemRenderer,
        private TranslatorInterface $translator,
    ) {
    }

    public function __invoke(ExceptionEvent $event): void
    {
        $request = $event->getRequest();

        if (!\str_starts_with($request->getPathInfo(), '/api')) {
            return;
        }

        $e = $event->getThrowable();

        if ($e instanceof ShapeRefusal) {
            $locale = $request->attributes->get(RequestLocaleListener::ATTRIBUTE);
            $e = $e->in($this->translator, \is_string($locale) ? $locale : null);
        }

        [$code, $violations] = $this->classify($e);

        if ($code->status() >= 500) {
            $this->logger->error($e->getMessage(), ['exception' => $e]);
        }

        $response = $this->problemRenderer->render(
            $request,
            $code,
            $e instanceof ValidationFailedException ? '' : $e->getMessage(),
            $violations,
            $this->headersOf($e),
            $e instanceof ApiException ? $e->members : [],
        );

        $event->setResponse($response);
    }

    /** @return array{0: ErrorCode, 1: list<array{propertyPath: string, message: string, code: string}>} */
    private function classify(Throwable $e): array
    {
        if ($e instanceof ApiException) {
            return [$e->errorCode, $e->violations];
        }

        if ($e instanceof ValidationFailedException) {
            return [ErrorCode::ValidationFailed, $this->violationsFrom($e)];
        }

        if ($e instanceof HttpExceptionInterface) {
            return [ErrorCode::forStatus($e->getStatusCode()), []];
        }

        return [ErrorCode::InternalError, []];
    }

    /** @return array<string, string> */
    private function headersOf(Throwable $e): array
    {
        if ($e instanceof ApiException) {
            return $e->headers;
        }

        if ($e instanceof MethodNotAllowedHttpException) {
            return ['Allow' => (string) $e->getHeaders()['Allow']];
        }

        return [];
    }

    /** @return list<array{propertyPath: string, message: string, code: string}> */
    private function violationsFrom(ValidationFailedException $e): array
    {
        $violations = [];
        foreach ($e->getViolations() as $violation) {
            $violations[] = [
                'propertyPath' => $violation->getPropertyPath(),
                'message' => (string) $violation->getMessage(),
                'code' => (string) $violation->getCode(),
            ];
        }

        return $violations;
    }
}
