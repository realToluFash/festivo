<?php

declare(strict_types=1);

namespace App\Domain\Organisation\AuditLog;

use App\Enum\AuditType;
use App\Http\Exception\ApiException;
use App\Repository\AuditFilter;
use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use Psl\Regex;
use Symfony\Component\Uid\Uuid;

/** The filters a reader chose, read as they meant them: From and To are days in their zone, and nothing is older than the 365 days kept before the moment they asked. */
final readonly class AuditFilters
{
    public const string KEPT_FOR = 'P365D';

    private const string DAY = '/^\d{4}-\d{2}-\d{2}$/';

    /** @param array<string, string> $asked person, type, event, from and to */
    public function asked(Uuid $organisationId, array $asked, DateTimeZone $zone, DateTimeImmutable $at): AuditFilter
    {
        $utc = new DateTimeZone('UTC');
        $from = self::day($asked['from'] ?? null, 'from', $zone);
        $to = self::day($asked['to'] ?? null, 'to', $zone);

        if (null !== $from && null !== $to && $from > $to) {
            throw ApiException::validation([['propertyPath' => 'to', 'message' => 'audit.dates_backwards', 'code' => 'dates_backwards']]);
        }

        $type = $asked['type'] ?? null;

        return new AuditFilter(
            $organisationId,
            $at->setTimezone($utc)->sub(new DateInterval(self::KEPT_FOR)),
            self::uuid($asked['person'] ?? null, 'person'),
            null === $type ? null : AuditType::tryFrom($type) ?? throw ApiException::validation([['propertyPath' => 'type', 'message' => 'audit.invalid_filter', 'code' => 'invalid_choice']]),
            self::uuid($asked['event'] ?? null, 'event'),
            $from?->setTimezone($utc),
            $to?->modify('+1 day')->setTimezone($utc),
        );
    }

    private static function day(?string $day, string $field, DateTimeZone $zone): ?DateTimeImmutable
    {
        if (null === $day || '' === $day) {
            return null;
        }

        $parsed = Regex\matches($day, self::DAY) ? DateTimeImmutable::createFromFormat('!Y-m-d', $day, $zone) : false;

        return false === $parsed || $parsed->format('Y-m-d') !== $day ? throw ApiException::validation([['propertyPath' => $field, 'message' => 'audit.invalid_filter', 'code' => 'invalid_date']]) : $parsed;
    }

    private static function uuid(?string $id, string $field): ?Uuid
    {
        if (null === $id || '' === $id) {
            return null;
        }

        return Uuid::isValid($id) ? Uuid::fromString($id) : throw ApiException::validation([['propertyPath' => $field, 'message' => 'audit.invalid_filter', 'code' => 'invalid_choice']]);
    }
}
