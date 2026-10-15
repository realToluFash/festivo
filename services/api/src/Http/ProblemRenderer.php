<?php

declare(strict_types=1);

namespace App\Http;

use App\Enum\ErrorCode;
use App\Http\Listener\CorrelationIdListener;
use App\Locale\Listener\RequestLocaleListener;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Contracts\Translation\TranslatorInterface;

final readonly class ProblemRenderer
{
    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /**
     * @param list<array{propertyPath: string, message: string, code: string}> $violations
     * @param array<string, string>                                            $headers
     */
    public function render(
        Request $request,
        ErrorCode $code,
        string $detail = '',
        array $violations = [],
        array $headers = [],
    ): JsonResponse {
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

        if ($code->status() < 500 && '' !== $detail) {
            $problem['detail'] = $detail;
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

        foreach ($headers as $name => $value) {
            $response->headers->set($name, $value);
        }

        return $response;
    }
}
