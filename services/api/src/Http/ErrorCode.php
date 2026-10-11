<?php

declare(strict_types=1);

namespace App\Http;

/**
 * Every error this API can return.
 *
 * One registry, deliberately. A code is the stable identifier a client
 * translates against, and codes invented at the call site cannot be enumerated,
 * cannot be translated ahead of time, and drift into near-duplicates —
 * not_found, notfound, resource_missing — that all mean the same thing to a
 * person and different things to a switch statement.
 *
 * Adding a case here without a matching key in all four translation files fails
 * ErrorCodeCatalogueTest. That is the point of the enum: the set is closed, so
 * the test can walk it.
 */
enum ErrorCode: string
{
    // Request shape
    case BadRequest = 'bad_request';
    case ValidationFailed = 'validation_failed';
    case MethodNotAllowed = 'method_not_allowed';
    case NotFound = 'not_found';
    case Conflict = 'conflict';
    case UnsupportedMediaType = 'unsupported_media_type';

    // Who is asking
    case Unauthenticated = 'unauthenticated';
    case Forbidden = 'forbidden';
    case TooManyRequests = 'too_many_requests';

    // Ours
    case InternalError = 'internal_error';
    case ServiceUnavailable = 'service_unavailable';

    public function status(): int
    {
        return match ($this) {
            self::BadRequest => 400,
            self::ValidationFailed => 422,
            self::MethodNotAllowed => 405,
            self::NotFound => 404,
            self::Conflict => 409,
            self::UnsupportedMediaType => 415,
            self::Unauthenticated => 401,
            self::Forbidden => 403,
            self::TooManyRequests => 429,
            self::InternalError => 500,
            self::ServiceUnavailable => 503,
        };
    }

    /** The key its message lives under, in every locale file. */
    public function translationKey(): string
    {
        return 'errors.' . $this->value;
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
