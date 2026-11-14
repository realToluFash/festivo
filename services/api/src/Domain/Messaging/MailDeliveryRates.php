<?php

declare(strict_types=1);

namespace App\Domain\Messaging;

use App\Enum\MailProviderReport;
use App\Enum\NotificationChannel;
use App\Enum\NotificationDeliveryStatus;
use DateInterval;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Psl\Str;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Psr\Log\LoggerInterface;

/** Run from cron, as NotificationPathCheck is. Over a threshold it writes a critical line; getting that line to a person is sc-1612's. */
final readonly class MailDeliveryRates
{
    public const float BOUNCES_OVER = 0.02;

    public const float COMPLAINTS_OVER = 0.0008;

    public function __construct(
        private Connection $connection,
        private ClockInterface $clock,
        private LoggerInterface $logger,
    ) {
    }

    /** @return array{sent: int, bounced: int, complained: int, alerts: list<string>} the last 24 hours' emails, and which rates were over */
    public function check(): array
    {
        $row = $this->connection->fetchAssociative(
            <<<'SQL'
                SELECT COUNT(*) AS sent,
                       COUNT(*) FILTER (WHERE provider_report = :bounced) AS bounced,
                       COUNT(*) FILTER (WHERE provider_report = :complained) AS complained
                FROM notification_deliveries
                WHERE channel = :email
                  AND status = :sentStatus
                  AND collapsed_into IS NULL
                  AND finished_at > :since
                SQL,
            [
                'bounced' => MailProviderReport::Bounced->value,
                'complained' => MailProviderReport::Complained->value,
                'email' => NotificationChannel::Email->value,
                'sentStatus' => NotificationDeliveryStatus::Sent->value,
                'since' => $this->clock->now()->sub(new DateInterval('PT24H')),
            ],
            ['since' => Types::DATETIME_IMMUTABLE],
        );

        $sent = false === $row ? 0 : Type\int()->coerce($row['sent']);
        $bounced = false === $row ? 0 : Type\int()->coerce($row['bounced']);
        $complained = false === $row ? 0 : Type\int()->coerce($row['complained']);
        $alerts = [];

        if ($sent > 0 && $bounced / $sent > self::BOUNCES_OVER) {
            $alerts[] = 'bounces';
            $this->alert('bounces', $bounced, $sent, self::BOUNCES_OVER);
        }

        if ($sent > 0 && $complained / $sent > self::COMPLAINTS_OVER) {
            $alerts[] = 'complaints';
            $this->alert('complaints', $complained, $sent, self::COMPLAINTS_OVER);
        }

        return ['sent' => $sent, 'bounced' => $bounced, 'complained' => $complained, 'alerts' => $alerts];
    }

    private function alert(string $what, int $count, int $sent, float $threshold): void
    {
        $rate = Str\format('%.2f%%', 100 * $count / $sent);
        $over = Str\format('%.2f%%', 100 * $threshold);

        $this->logger->critical(Str\format('Email %s are at %s of the last 24 hours\' %d sends, over the %s threshold.', $what, $rate, $sent, $over), [
            'symptom' => 'email_' . $what,
            'rate' => $rate,
            'threshold' => $over,
            'sent' => $sent,
        ]);
    }
}
