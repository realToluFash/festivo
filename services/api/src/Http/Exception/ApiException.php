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
     * @param list<array{propertyPath: string, message: string, code: string, parameters?: array<string, string>}> $violations each message a key, its slots in parameters
     * @param array<string, string>                                                                                $headers    Retry-After on a 429, and little else
     * @param array<string, int|string|list<string>>                                                               $members    extra problem members, such as the permission
     * @param array<string, string>                                                                                $parameters the slots in the message's key
     */
    public function __construct(
        public readonly ErrorCode $errorCode,
        string $message = '',
        public readonly array $violations = [],
        ?Throwable $previous = null,
        public readonly array $headers = [],
        public readonly array $members = [],
        public readonly array $parameters = [],
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

    /** @param list<array{propertyPath: string, message: string, code: string, parameters?: array<string, string>}> $violations */
    public static function validation(array $violations, string $message = ''): self
    {
        return new self(ErrorCode::ValidationFailed, $message, $violations);
    }

    /** A 429 that names the minute the window ends, as every limit a person can hit does: its key has a {time} slot. */
    public static function tooManyAttempts(string $refusal, DateTimeImmutable $windowEnd): self
    {
        return new self(
            ErrorCode::TooManyAttempts,
            $refusal,
            [],
            null,
            ['Retry-After' => (string) self::secondsUntil($windowEnd)],
            [],
            ['{time}' => self::statedMinute($windowEnd)->format('H:i')],
        );
    }

    /**
     * The same 429, its minute written for the reader ("Sunday, Oct 18 at 17:09 WAT"), carried as `retryAt` and
     * given to the key's {when} slot.
     *
     * @param callable(DateTimeImmutable): string $written
     */
    public static function tooManyAttemptsUntil(string $refusal, DateTimeImmutable $windowEnd, callable $written): self
    {
        $when = $written(self::statedMinute($windowEnd));

        return new self(
            ErrorCode::TooManyAttempts,
            $refusal,
            [],
            null,
            ['Retry-After' => (string) self::secondsUntil($windowEnd)],
            ['retryAt' => $when],
            ['{when}' => $when],
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
