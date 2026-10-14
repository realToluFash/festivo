<?php

declare(strict_types=1);

namespace App\Http\Exception;

use App\Enum\ErrorCode;
use RuntimeException;
use Throwable;

class ApiException extends RuntimeException
{
    /** @param list<array{propertyPath: string, message: string, code: string}> $violations */
    public function __construct(
        public readonly ErrorCode $errorCode,
        string $message = '',
        public readonly array $violations = [],
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

    /** @param list<array{propertyPath: string, message: string, code: string}> $violations */
    public static function validation(array $violations, string $message = ''): self
    {
        return new self(ErrorCode::ValidationFailed, $message, $violations);
    }
}
