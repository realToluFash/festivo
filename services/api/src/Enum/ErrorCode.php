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
    case OAuthTokenInvalid = 'oauth_token_invalid';
    case ResetLinkInvalid = 'reset_link_invalid';
    case ResetLinkUsed = 'reset_link_used';
    case ResetLinkExpired = 'reset_link_expired';
    case TwoFactorChallengeInvalid = 'two_factor_challenge_invalid';
    case Forbidden = 'forbidden';
    case PermissionRequired = 'permission_required';
    case AccountUnverified = 'account_unverified';
    case ProfileIncomplete = 'profile_incomplete';
    case TooManyRequests = 'too_many_requests';
    case TooManyAttempts = 'too_many_attempts';

    case VerificationCodeInvalid = 'verification_code_invalid';
    case VerificationCodeExpired = 'verification_code_expired';
    case VerificationCodeExhausted = 'verification_code_exhausted';

    case TwoFactorCodeInvalid = 'two_factor_code_invalid';
    case RecoveryCodeUsed = 'recovery_code_used';
    case TwoFactorAlreadyOn = 'two_factor_already_on';
    case TwoFactorNotEnrolled = 'two_factor_not_enrolled';
    case TwoFactorOff = 'two_factor_off';

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
            self::NotFound, self::ResetLinkInvalid => 404,
            self::ResetLinkUsed, self::ResetLinkExpired => 410,
            self::Conflict, self::EmailTaken, self::PhoneTaken, self::TwoFactorAlreadyOn, self::TwoFactorNotEnrolled, self::TwoFactorOff => 409,
            self::UnsupportedMediaType => 415,
            self::Unauthenticated, self::InvalidCredentials, self::InvalidRefreshToken, self::OAuthTokenInvalid, self::TwoFactorChallengeInvalid => 401,
            self::Forbidden, self::PermissionRequired, self::AccountUnverified, self::ProfileIncomplete => 403,
            self::TooManyRequests, self::TooManyAttempts => 429,
            self::VerificationCodeInvalid, self::VerificationCodeExpired => 422,
            self::VerificationCodeExhausted => 422,
            self::TwoFactorCodeInvalid, self::RecoveryCodeUsed => 422,
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
