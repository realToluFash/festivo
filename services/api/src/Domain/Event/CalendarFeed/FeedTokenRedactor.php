<?php

declare(strict_types=1);

namespace App\Domain\Event\CalendarFeed;

use Monolog\Attribute\AsMonologProcessor;
use Monolog\LogRecord;
use Monolog\Processor\ProcessorInterface;
use Psl\Dict;
use Psl\Regex;

/**
 * A calendar link's token is its whole credential (sc-3626), and the router logs every matched path and its parameters. This takes it out of every record, in every channel, before any handler writes it.
 */
#[AsMonologProcessor]
final readonly class FeedTokenRedactor implements ProcessorInterface
{
    public const string REDACTED = '[redacted]';

    private const string IN_PATH = '#(calendar-feeds/)[A-Za-z0-9_-]{43}#';

    public function __invoke(LogRecord $record): LogRecord
    {
        return $record->with(
            message: self::redact($record->message),
            context: self::redactAll($record->context),
            extra: self::redactAll($record->extra),
        );
    }

    /**
     * @param array<mixed> $values
     *
     * @return array<mixed>
     */
    private static function redactAll(array $values): array
    {
        $calendarFeed = 'calendar_feed' === ($values['_route'] ?? null);

        return Dict\map_with_key($values, static fn (int|string $key, mixed $value): mixed => match (true) {
            $calendarFeed && 'token' === $key => self::REDACTED,
            \is_string($value) => self::redact($value),
            \is_array($value) => self::redactAll($value),
            default => $value,
        });
    }

    private static function redact(string $value): string
    {
        return Regex\replace($value, self::IN_PATH, '${1}' . self::REDACTED);
    }
}
