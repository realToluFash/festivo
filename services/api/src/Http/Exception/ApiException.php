<?php

declare(strict_types=1);

namespace App\Http\Exception;

use App\Http\ErrorCode;
use RuntimeException;
use Throwable;

/**
 * An error the API means to return, as opposed to one that happened to it.
 *
 * Carrying the code rather than only a status is what lets a client branch on
 * the reason. Two different 409s are the same HTTP status and entirely
 * different problems.
 */
class ApiException extends RuntimeException
{
    /**
     * @param array<string, array{code: string, message: string}> $fields
     */
    public function __construct(
        // Not $code: \Exception already owns that, as an int. Shadowing it with
        // an enum is a fatal error, and the name collision is itself a reason
        // to be explicit — "the error code" and "the HTTP status" are different
        // facts and were conflated throughout the previous build.
        public readonly ErrorCode $errorCode,
        string $message = '',
        public readonly array $fields = [],
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, $errorCode->status(), $previous);
    }

    public static function notFound(string $message = ''): self
    {
        return new self(ErrorCode::NotFound, $message);
    }

    public static function forbidden(string $message = ''): self
    {
        return new self(ErrorCode::Forbidden, $message);
    }

    public static function conflict(string $message = ''): self
    {
        return new self(ErrorCode::Conflict, $message);
    }

    /**
     * @param array<string, array{code: string, message: string}> $fields
     */
    public static function validation(array $fields, string $message = ''): self
    {
        return new self(ErrorCode::ValidationFailed, $message, $fields);
    }
}
