<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Webhook;

use App\Domain\Messaging\GuestMessages\GuestMessagesChanged;
use App\Enum\MailProviderReport;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Psl\Type;
use Psr\Clock\ClockInterface;

/** One status report from Twilio on one text Soirely sent (sc-3946): the delivery that carries its SID takes the report, and Twilio's error code is kept with it. */
final readonly class SmsStatusWebhook
{
    public function __construct(
        private Connection $connection,
        private GuestMessagesChanged $guestMessagesChanged,
        private ClockInterface $clock,
    ) {
    }

    /** @return ?MailProviderReport what it said, or null for a report that changes nothing: queued and sent say the phone has not got it yet */
    public function receive(string $sid, string $status, ?string $errorCode): ?MailProviderReport
    {
        $said = match ($status) {
            'delivered' => MailProviderReport::Delivered,
            'undelivered', 'failed' => MailProviderReport::Bounced,
            default => null,
        };

        if (null === $said || '' === $sid) {
            return null;
        }

        $earlier = $this->connection->fetchAssociative(
            'SELECT id, provider_report FROM notification_deliveries WHERE provider_message_id = :sid',
            ['sid' => $sid],
        );

        if (false === $earlier) {
            return null;
        }

        $was = Type\nullable(Type\string())->coerce($earlier['provider_report']);

        if (!$said->outranks(null === $was ? null : MailProviderReport::from($was))) {
            return null;
        }

        $id = Type\string()->coerce($earlier['id']);
        $this->connection->executeStatement(
            'UPDATE notification_deliveries SET provider_report = :report, provider_code = :code, provider_reported_at = :now WHERE id = :id',
            [
                'report' => $said->value,
                'code' => MailProviderReport::Delivered === $said || '' === $errorCode ? null : $errorCode,
                'now' => $this->clock->now(),
                'id' => $id,
            ],
            ['now' => Types::DATETIME_IMMUTABLE],
        );
        $this->guestMessagesChanged->afterDelivery($id);

        return $said;
    }
}
