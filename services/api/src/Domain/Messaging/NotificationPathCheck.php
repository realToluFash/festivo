<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Domain\Messaging\Model\PathSymptom;
use App\Enum\NotificationDeliveryStatus;
use App\Enum\ScheduledNotificationStatus;
use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Psl\Str;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Psr\Log\LoggerInterface;

/** Run from cron, never from the worker, which would fall silent with it. Held, backing-off and claimed rows are not waiting. */
final readonly class NotificationPathCheck
{
    public const string STOPPED_AFTER = 'PT5M';

    public const string BEHIND_AFTER = 'PT30M';

    public const float FAILING_RATE = 0.05;

    public const int FAILING_MINIMUM = 20;

    public function __construct(
        private Connection $connection,
        private ClockInterface $clock,
        private LoggerInterface $logger,
    ) {
    }

    /** @return list<PathSymptom> each also written as a critical log line */
    public function run(): array
    {
        $now = $this->clock->now();
        $waiting = $this->waiting($now);
        $symptoms = [];

        if (null !== $waiting['oldest']) {
            $lastClaim = $this->lastClaim();
            $stoppedSince = $now->sub(new DateInterval(self::STOPPED_AFTER));

            if ($waiting['oldest'] < $stoppedSince && (null === $lastClaim || $lastClaim < $stoppedSince)) {
                $symptoms[] = PathSymptom::Stopped;
                $this->logger->critical(Str\format('Notifications have stopped: %d waiting, the oldest due at %s, and nothing claimed in 5 minutes.', $waiting['count'], $waiting['oldest']->format(\DATE_ATOM)), [
                    'symptom' => PathSymptom::Stopped->value,
                    'waiting' => $waiting['count'],
                    'oldest' => $waiting['oldest']->format(\DATE_ATOM),
                ]);
            }

            if ($waiting['oldest'] < $now->sub(new DateInterval(self::BEHIND_AFTER))) {
                $symptoms[] = PathSymptom::Behind;
                $this->logger->critical(Str\format('Notifications are behind: %d waiting, the oldest due at %s, over 30 minutes ago.', $waiting['count'], $waiting['oldest']->format(\DATE_ATOM)), [
                    'symptom' => PathSymptom::Behind->value,
                    'waiting' => $waiting['count'],
                    'oldest' => $waiting['oldest']->format(\DATE_ATOM),
                ]);
            }
        }

        [$sent, $failed] = $this->lastHour($now);

        if ($sent + $failed >= self::FAILING_MINIMUM && $failed / ($sent + $failed) > self::FAILING_RATE) {
            $symptoms[] = PathSymptom::Failing;
            $this->logger->critical(Str\format('Notifications are failing: %.1f%% of the last hour\'s %d sends ended Failed.', 100 * $failed / ($sent + $failed), $sent + $failed), [
                'symptom' => PathSymptom::Failing->value,
                'rate' => Str\format('%.1f%%', 100 * $failed / ($sent + $failed)),
                'total' => $sent + $failed,
            ]);
        }

        return $symptoms;
    }

    /** @return array{count: int, oldest: ?DateTimeImmutable} */
    private function waiting(DateTimeImmutable $now): array
    {
        $row = $this->connection->fetchAssociative(
            <<<'SQL'
                SELECT COUNT(*) AS count, MIN(since) AS oldest
                FROM (
                    SELECT due_at AS since
                    FROM scheduled_notifications
                    WHERE status = :scheduledPending
                      AND due_at <= :now
                      AND (claimed_until IS NULL OR claimed_until < :now)
                    UNION ALL
                    SELECT next_attempt_at
                    FROM notification_deliveries
                    WHERE status = :deliveryPending
                      AND held IS NULL
                      AND next_attempt_at <= :now
                      AND (claimed_until IS NULL OR claimed_until < :now)
                ) waiting
                SQL,
            [
                'now' => $now,
                'scheduledPending' => ScheduledNotificationStatus::Pending->value,
                'deliveryPending' => NotificationDeliveryStatus::Pending->value,
            ],
            ['now' => Types::DATETIME_IMMUTABLE],
        );

        $oldest = false === $row ? null : Type\nullable(Type\string())->coerce($row['oldest']);

        return [
            'count' => false === $row ? 0 : Type\int()->coerce($row['count']),
            'oldest' => null === $oldest ? null : new DateTimeImmutable($oldest, new DateTimeZone('UTC')),
        ];
    }

    private function lastClaim(): ?DateTimeImmutable
    {
        $last = Type\nullable(Type\string())->coerce($this->connection->fetchOne(
            <<<'SQL'
                SELECT GREATEST(
                    (SELECT MAX(claimed_at) FROM scheduled_notifications),
                    (SELECT MAX(claimed_at) FROM notification_deliveries)
                )
                SQL,
        ));

        return null === $last ? null : new DateTimeImmutable($last, new DateTimeZone('UTC'));
    }

    /** @return array{int, int} sent and failed, finished in the last hour */
    private function lastHour(DateTimeImmutable $now): array
    {
        $row = $this->connection->fetchAssociative(
            <<<'SQL'
                SELECT COUNT(*) FILTER (WHERE status = :sent) AS sent, COUNT(*) FILTER (WHERE status = :failed) AS failed
                FROM notification_deliveries
                WHERE finished_at > :since
                  AND collapsed_into IS NULL
                SQL,
            [
                'sent' => NotificationDeliveryStatus::Sent->value,
                'failed' => NotificationDeliveryStatus::Failed->value,
                'since' => $now->sub(new DateInterval('PT1H')),
            ],
            ['since' => Types::DATETIME_IMMUTABLE],
        );

        return false === $row ? [0, 0] : [Type\int()->coerce($row['sent']), Type\int()->coerce($row['failed'])];
    }
}
