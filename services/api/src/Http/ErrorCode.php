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

    /**
     * The translation domain its message lives in.
     *
     * Messages are in translations/errors.<locale>.json, keyed by the bare
     * value — `not_found`, not `errors.not_found`. Passing a domain-prefixed
     * key INTO that domain looks up `errors.not_found` inside errors.*.json,
     * finds nothing, and renders the key itself as the title.
     */
    public const DOMAIN = 'errors';

    /** The key its message lives under, within self::DOMAIN. */
    public function translationKey(): string
    {
        return $this->value;
    }

    /**
     * The RFC 7807 `type` for this code.
     *
     * A problem document's type is exactly what this enum was invented to be —
     * a stable machine identifier a client branches and translates on, distinct
     * from the human sentence beside it. So rather than inventing a `code`
     * field alongside it, the code IS the type.
     *
     * The URI is an identifier, not a promise to serve a page there.
     */
    public function type(): string
    {
        return 'https://soirely.com/errors/' . $this->value;
    }

    public static function fromType(string $type): ?self
    {
        $prefix = 'https://soirely.com/errors/';
        $value = str_starts_with($type, $prefix) ? substr($type, \strlen($prefix)) : $type;

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
