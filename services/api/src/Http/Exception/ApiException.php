<?php

declare(strict_types=1);

namespace App\Http\Exception;

use App\Enum\ErrorCode;
use DateTimeImmutable;
use Psl\Math;
use RuntimeException;
use Throwable;

class ApiException extends RuntimeException
{
    /**
     * @param list<array{propertyPath: string, message: string, code: string}> $violations
     * @param array<string, string>                                            $headers    Retry-After on a 429,
     *                                                                                     and little else
     * @param array<string, string>                                            $members    extra problem members,
     *                                                                                     such as the permission
     */
    public function __construct(
        public readonly ErrorCode $errorCode,
        string $message = '',
        public readonly array $violations = [],
        ?Throwable $previous = null,
        public readonly array $headers = [],
        public readonly array $members = [],
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

    /** A 429 that names the minute the window ends, as every limit a person can hit does. */
    public static function tooManyAttempts(string $refusal, DateTimeImmutable $windowEnd): self
    {
        return new self(
            ErrorCode::TooManyAttempts,
            $refusal . ' Try again at ' . self::statedMinute($windowEnd)->format('H:i') . '.',
            [],
            null,
            ['Retry-After' => (string) self::secondsUntil($windowEnd)],
        );
    }

    /** Rounded up, as the clients round it: told 22:46, whoever tries at 22:46:01 gets in. */
    private static function statedMinute(DateTimeImmutable $windowEnd): DateTimeImmutable
    {
        $lifts = $windowEnd->getTimestamp() + 1;

        return $windowEnd->setTimestamp(Math\div($lifts + 59, 60) * 60);
    }

    /** One past the window's end: a fixed window still counts its hits at the end second itself. */
    private static function secondsUntil(DateTimeImmutable $moment): int
    {
        return Math\maxva(1, $moment->getTimestamp() - new DateTimeImmutable()->getTimestamp() + 1);
    }
}
