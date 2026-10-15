<?php

declare(strict_types=1);

namespace App\Http\Listener;

use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\Listener\RequestLocaleListener;
use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\Validator\Exception\ValidationFailedException;
use Symfony\Contracts\Translation\TranslatorInterface;
use Throwable;

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

        if (!\str_starts_with($request->getPathInfo(), '/api')) {
            return;
        }

        $e = $event->getThrowable();
        [$code, $violations] = $this->classify($e);

        if ($code->status() >= 500) {
            $this->logger->error($e->getMessage(), ['exception' => $e]);
        }

        $locale = $request->attributes->get(RequestLocaleListener::ATTRIBUTE);

        $problem = [
            'type' => $code->type(),
            'title' => $this->translator->trans(
                $code->translationKey(),
                [],
                ErrorCode::DOMAIN,
                \is_string($locale) ? $locale : null,
            ),
            'status' => $code->status(),
        ];

        if ($code->status() < 500 && '' !== $e->getMessage()) {
            $problem['detail'] = $e->getMessage();
        }

        if ([] !== $violations) {
            $problem['violations'] = $violations;
        }

        $correlationId = $request->attributes->get(CorrelationIdListener::ATTRIBUTE);
        if (\is_string($correlationId)) {
            $problem['correlationId'] = $correlationId;
        }

        $response = new JsonResponse($problem, $code->status());
        $response->headers->set('Content-Type', 'application/problem+json');

        if ($e instanceof ApiException) {
            foreach ($e->headers as $name => $value) {
                $response->headers->set($name, $value);
            }
        }
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
