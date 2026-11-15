<?php

declare(strict_types=1);

namespace App\Http;

use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use Symfony\Contracts\Translation\TranslatorInterface;

/** A code as typed: only a JSON string, never a coerced number; else a field error, before any try is spent. */
final readonly class CodeField
{
    public const string FROM_EMAIL = 'validation.code_email_required';
    public const string FROM_TEXT = 'validation.code_text_required';
    public const string FROM_APP = 'validation.code_app_required';
    public const string RECOVERY = 'validation.recovery_code_required';
    public const string FROM_APP_OR_RECOVERY = 'validation.code_app_or_recovery_required';

    public function __construct(
        private TranslatorInterface $translator,
    ) {
    }

    /** @param array<string, mixed> $body */
    public function required(array $body, string $field, string $message): string
    {
        return $this->optional($body, $field, $message) ?? throw $this->refused($field, $message);
    }

    /** @param array<string, mixed> $body */
    public function optional(array $body, string $field, string $message): ?string
    {
        $value = $body[$field] ?? null;

        if (null === $value || \is_string($value)) {
            return $value;
        }

        throw $this->refused($field, $message);
    }

    private function refused(string $field, string $message): ApiException
    {
        return ApiException::validation([[
            'propertyPath' => $field,
            'message' => $this->translator->trans($message),
            'code' => ErrorCode::ValidationFailed->value,
        ]]);
    }
}
