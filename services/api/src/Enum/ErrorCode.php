<?php

declare(strict_types=1);

namespace App\Enum;

// A case added here without a key in all four translation files fails
// ErrorCodeCatalogueTest. The set being closed is what lets the test walk it.
enum ErrorCode: string
{
    case BadRequest = 'bad_request';
    case ValidationFailed = 'validation_failed';
    case MethodNotAllowed = 'method_not_allowed';
    case NotFound = 'not_found';
    case Conflict = 'conflict';
    case EmailTaken = 'email_taken';
    case PhoneTaken = 'phone_taken';
    case UnsupportedMediaType = 'unsupported_media_type';

    case Unauthenticated = 'unauthenticated';
    case InvalidCredentials = 'invalid_credentials';
    case InvalidRefreshToken = 'invalid_refresh_token';
    case Forbidden = 'forbidden';
    case PermissionRequired = 'permission_required';
    case TooManyRequests = 'too_many_requests';
    case TooManyAttempts = 'too_many_attempts';

    case VerificationCodeInvalid = 'verification_code_invalid';
    case VerificationCodeExpired = 'verification_code_expired';
    case VerificationCodeExhausted = 'verification_code_exhausted';

    case InternalError = 'internal_error';
    case ServiceUnavailable = 'service_unavailable';

    case AssistantUnavailable = 'assistant_unavailable';
    case AssistantBusy = 'assistant_busy';
    case AssistantRefused = 'assistant_refused';

    public function status(): int
    {
        return match ($this) {
            self::BadRequest => 400,
            self::ValidationFailed => 422,
            self::MethodNotAllowed => 405,
            self::NotFound => 404,
            self::Conflict, self::EmailTaken, self::PhoneTaken => 409,
            self::UnsupportedMediaType => 415,
            self::Unauthenticated, self::InvalidCredentials, self::InvalidRefreshToken => 401,
            self::Forbidden, self::PermissionRequired => 403,
            self::TooManyRequests, self::TooManyAttempts => 429,
            self::VerificationCodeInvalid, self::VerificationCodeExpired => 422,
            self::VerificationCodeExhausted => 422,
            self::InternalError => 500,
            self::ServiceUnavailable => 503,
            self::AssistantUnavailable, self::AssistantBusy => 503,

            self::AssistantRefused => 422,
        };
    }

    public const DOMAIN = 'errors';

    public function translationKey(): string
    {
        return $this->value;
    }

    public function type(): string
    {
        return 'https://soirely.com/errors/' . $this->value;
    }

    public static function fromType(string $type): ?self
    {
        $prefix = 'https://soirely.com/errors/';
        $value = \str_starts_with($type, $prefix) ? \substr($type, \strlen($prefix)) : $type;

        return self::tryFrom($value);
    }

    public static function forStatus(int $status): self
    {
        foreach (self::cases() as $case) {
            if ($case->status() === $status) {
                return $case;
            }
        }

        return $status >= 500 ? self::InternalError : self::BadRequest;
    }
}
