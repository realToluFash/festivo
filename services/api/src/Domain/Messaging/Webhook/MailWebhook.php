<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Webhook;

use App\Domain\Messaging\EmailSuppressions;
use App\Domain\Messaging\GuestMessages\GuestComplaints;
use App\Domain\Messaging\GuestMessages\GuestMessagesChanged;
use App\Enum\DeliveryNotSentReason;
use App\Enum\MailProviderReport;
use App\Enum\NotificationAudienceKind;
use App\Enum\NotificationChannel;
use App\Enum\NotificationDeliveryStatus;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Psl\Regex;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** One provider report on one email Soirely sent (sc-4332): the delivery it names is updated, a hard bounce or complaint suppresses the address, and a guest's complaint is kept for the organisation (sc-3942). */
final readonly class MailWebhook
{
    /** Postmark's report of an email it would not hand over, the address being on its inactive list. */
    private const string PROVIDER_BLOCKED = 'ManuallyDeactivated';

    public function __construct(
        private Connection $connection,
        private EmailSuppressions $emailSuppressions,
        private GuestComplaints $guestComplaints,
        private GuestMessagesChanged $guestMessagesChanged,
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
            'Details' => Type\optional(Type\nullable(Type\string())),
            'Metadata' => Type\optional(Type\nullable(Type\dict(Type\string(), Type\mixed()))),
        ], true)->coerce($report);

        $delivery = $shape['Metadata']['delivery'] ?? null;
        $delivery = \is_string($delivery) && Uuid::isValid($delivery) ? $delivery : null;

        if ('Bounce' === $shape['RecordType'] && self::PROVIDER_BLOCKED === ($shape['Type'] ?? null)) {
            if (null !== $delivery) {
                $this->blocked($delivery);
            }

            return null;
        }

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

        if (null !== $delivery) {
            $this->record($delivery, $said, MailProviderReport::Delivered === $said ? null : self::code($shape['Details'] ?? null));
        }

        return $said;
    }

    private function record(string $deliveryId, MailProviderReport $said, ?string $code): void
    {
        $earlier = $this->connection->fetchAssociative(
            'SELECT provider_report, recipient_kind, recipient_id, address FROM notification_deliveries WHERE id = :id AND channel = :email',
            ['id' => $deliveryId, 'email' => NotificationChannel::Email->value],
        );

        if (false === $earlier) {
            return;
        }

        $was = Type\nullable(Type\string())->coerce($earlier['provider_report']);

        if (!$said->outranks(null === $was ? null : MailProviderReport::from($was))) {
            return;
        }

        $now = $this->clock->now();
        $this->connection->transactional(function () use ($deliveryId, $said, $code, $now): void {
            $this->connection->executeStatement(
                'UPDATE notification_deliveries SET provider_report = :report, provider_code = :code, provider_reported_at = :now WHERE id = :id',
                ['report' => $said->value, 'code' => $code, 'now' => $now, 'id' => $deliveryId],
                ['now' => Types::DATETIME_IMMUTABLE],
            );

            if (MailProviderReport::Complained === $said) {
                $this->guestComplaints->keep($deliveryId);
            }
        });

        if (MailProviderReport::Bounced === $said && NotificationAudienceKind::Guest->value === $earlier['recipient_kind'] && null !== $earlier['address']) {
            $this->connection->executeStatement(
                'UPDATE guests SET email_bouncing_at = :now WHERE id = :guest AND LOWER(email) = LOWER(:address)',
                ['now' => $now, 'guest' => $earlier['recipient_id'], 'address' => $earlier['address']],
                ['now' => Types::DATETIME_IMMUTABLE],
            );
        }

        $this->guestMessagesChanged->afterDelivery($deliveryId);
    }

    private function blocked(string $deliveryId): void
    {
        $changed = $this->connection->executeStatement(
            'UPDATE notification_deliveries SET status = :failed, not_sent_reason = :blocked WHERE id = :id AND channel = :email AND provider_report IS NULL',
            [
                'failed' => NotificationDeliveryStatus::Failed->value,
                'blocked' => DeliveryNotSentReason::ProviderBlocked->value,
                'id' => $deliveryId,
                'email' => NotificationChannel::Email->value,
            ],
        );

        if ($changed > 0) {
            $this->guestMessagesChanged->afterDelivery($deliveryId);
        }
    }

    /** The enhanced status code in the receiving server's reply (RFC 3463), "5.1.1" say. */
    private static function code(?string $details): ?string
    {
        return null === $details ? null : (Regex\first_match($details, '/\\b[245]\\.\\d{1,3}\\.\\d{1,3}\\b/') ?? [])[0] ?? null;
    }
}
