<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Webhook;

use App\Domain\Messaging\EmailSuppressions;
use App\Enum\MailProviderReport;
use App\Enum\NotificationChannel;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** One provider report on one email Soirely sent (sc-4332): the delivery it names is updated, and a hard bounce or complaint suppresses the address. */
final readonly class MailWebhook
{
    public function __construct(
        private Connection $connection,
        private EmailSuppressions $emailSuppressions,
        private ClockInterface $clock,
    ) {
    }

    /**
     * Postmark's shape: RecordType Delivery, Bounce or SpamComplaint, the address, and the delivery id the email carried as metadata.
     *
     * @param array<array-key, mixed> $report
     *
     * @return ?MailProviderReport what it said, or null for a report that changes nothing, a soft bounce say
     */
    public function receive(array $report): ?MailProviderReport
    {
        $shape = Type\shape([
            'RecordType' => Type\string(),
            'Type' => Type\optional(Type\nullable(Type\string())),
            'Email' => Type\optional(Type\nullable(Type\string())),
            'Recipient' => Type\optional(Type\nullable(Type\string())),
            'Metadata' => Type\optional(Type\nullable(Type\dict(Type\string(), Type\mixed()))),
        ], true)->coerce($report);

        $said = match ($shape['RecordType']) {
            'Delivery' => MailProviderReport::Delivered,
            'Bounce' => 'HardBounce' === ($shape['Type'] ?? null) ? MailProviderReport::Bounced : null,
            'SpamComplaint' => MailProviderReport::Complained,
            default => null,
        };

        if (null === $said) {
            return null;
        }

        $address = $shape['Email'] ?? $shape['Recipient'] ?? null;

        if ($said->suppresses() && null !== $address && '' !== $address) {
            $this->emailSuppressions->suppress($address, $said);
        }

        $delivery = $shape['Metadata']['delivery'] ?? null;

        if (\is_string($delivery) && Uuid::isValid($delivery)) {
            $this->record($delivery, $said);
        }

        return $said;
    }

    private function record(string $deliveryId, MailProviderReport $said): void
    {
        $earlier = $this->connection->fetchAssociative(
            'SELECT provider_report FROM notification_deliveries WHERE id = :id AND channel = :email',
            ['id' => $deliveryId, 'email' => NotificationChannel::Email->value],
        );

        if (false === $earlier) {
            return;
        }

        $was = Type\nullable(Type\string())->coerce($earlier['provider_report']);

        if (!$said->outranks(null === $was ? null : MailProviderReport::from($was))) {
            return;
        }

        $this->connection->executeStatement(
            'UPDATE notification_deliveries SET provider_report = :report, provider_reported_at = :now WHERE id = :id',
            ['report' => $said->value, 'now' => $this->clock->now(), 'id' => $deliveryId],
            ['now' => Types::DATETIME_IMMUTABLE],
        );
    }
}
