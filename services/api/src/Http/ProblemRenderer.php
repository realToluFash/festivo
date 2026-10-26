<?php

declare(strict_types=1);

namespace App\Http;

use App\Enum\ErrorCode;
use App\Http\Listener\CorrelationIdListener;
use App\Locale\Listener\RequestLocaleListener;
use Psl\Regex;
use Psl\Vec;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Contracts\Translation\TranslatorInterface;

final readonly class ProblemRenderer
{
    public const string KEY = '/^[a-z0-9_]+(\.[a-z0-9_]+)+$/';

    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /**
     * @param list<array{propertyPath: string, message: string, code: string, parameters?: array<string, string>}> $violations
     * @param array<string, string>                                                                                $headers
     * @param array<string, int|string|list<string>>                                                               $members
     * @param array<string, int|string>                                                                            $parameters the detail key's slots
     */
    public function render(
        Request $request,
        ErrorCode $code,
        string $detail = '',
        array $violations = [],
        array $headers = [],
        array $members = [],
        array $parameters = [],
    ): JsonResponse {
        $locale = $request->attributes->get(RequestLocaleListener::ATTRIBUTE);
        $locale = \is_string($locale) ? $locale : null;

        $problem = [
            'type' => $code->type(),
            'title' => $this->titleOf($request, $code),
            'status' => $code->status(),
        ];

        $detail = $this->worded($detail, $parameters, $locale);
        $violations = Vec\map(
            $violations,
            fn (array $violation): array => [
                'propertyPath' => $violation['propertyPath'],
                'message' => $this->worded($violation['message'], $violation['parameters'] ?? [], $locale),
                'code' => $violation['code'],
            ],
        );

        if ('' === $detail && [] !== $violations) {
            $detail = $violations[0]['message'];
        }

        if ($code->status() < 500 && '' !== $detail) {
            $problem['detail'] = $detail;
        }

        if ([] !== $violations) {
            $problem['violations'] = $violations;
        }

        $problem += $members;

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

    public function titleOf(Request $request, ErrorCode $code): string
    {
        $locale = $request->attributes->get(RequestLocaleListener::ATTRIBUTE);

        return $this->translator->trans($code->translationKey(), [], ErrorCode::DOMAIN, \is_string($locale) ? $locale : null);
    }

    /**
     * A sentence was worded where it was thrown, or by the validator, and is left as it is.
     *
     * @param array<string, int|string> $parameters
     */
    private function worded(string $message, array $parameters, ?string $locale): string
    {
        return Regex\matches($message, self::KEY) ? $this->translator->trans($message, $parameters, null, $locale) : $message;
    }
}
