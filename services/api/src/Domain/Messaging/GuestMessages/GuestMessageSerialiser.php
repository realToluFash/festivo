<?php

declare(strict_types=1);

namespace App\Domain\Messaging\GuestMessages;

use App\Domain\Messaging\Audience\GuestConditions;
use App\Entity\GuestMessage;
use App\Enum\DeliveryNotSentReason;
use App\Enum\MailProviderReport;
use App\Enum\NotificationDeliveryStatus;
use DateTimeImmutable;
use DateTimeInterface;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Psl\Dict;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** A message as the host reads it (sc-3942): each delivery's state in one word, Sent, Delivered, Reported as spam, Bounced or Not sent with its reason; addresses only for those who manage guests. */
final readonly class GuestMessageSerialiser
{
    public const string QUEUED = 'queued';
    public const string SENT = 'sent';
    public const string DELIVERED = 'delivered';
    public const string REPORTED_AS_SPAM = 'reported_as_spam';
    public const string BOUNCED = 'bounced';
    public const string NOT_SENT = 'not_sent';

    public function __construct(
        private Connection $connection,
        private GuestConditions $guestConditions,
    ) {
    }

    /**
     * @param list<GuestMessage> $messages
     *
     * @return list<array<string, mixed>>
     */
    public function list(array $messages): array
    {
        if ([] === $messages) {
            return [];
        }

        $counts = Dict\from_entries(Vec\map(
            $this->connection->fetchAllAssociative(
                <<<'SQL'
                    SELECT source_id,
                           COUNT(*) AS total,
                           COUNT(*) FILTER (WHERE status = :sent AND (provider_report IS NULL OR provider_report <> :bounced)) AS reached,
                           COUNT(*) FILTER (WHERE status = :pending) AS queued
                    FROM notification_deliveries
                    WHERE type = :type AND source_id IN (:ids)
                    GROUP BY source_id
                    SQL,
                [
                    'sent' => NotificationDeliveryStatus::Sent->value,
                    'bounced' => MailProviderReport::Bounced->value,
                    'pending' => NotificationDeliveryStatus::Pending->value,
                    'type' => GuestMessageNotice::NAME,
                    'ids' => Vec\map($messages, static fn (GuestMessage $message): string => $message->getId()->toRfc4122()),
                ],
                ['ids' => ArrayParameterType::STRING],
            ),
            static fn (array $row): array => [Type\string()->coerce($row['source_id']), $row],
        ));

        return Vec\map($messages, function (GuestMessage $message) use ($counts): array {
            $row = $counts[$message->getId()->toRfc4122()] ?? [];

            return [
                ...$this->summary($message),
                'reached' => Type\int()->coerce($row['reached'] ?? 0),
                'deliveries' => Type\int()->coerce($row['total'] ?? 0),
                'sending' => 0 < Type\int()->coerce($row['queued'] ?? 0),
            ];
        });
    }

    /** @return array<string, mixed> */
    public function details(GuestMessage $message, bool $addresses): array
    {
        $rows = $this->connection->fetchAllAssociative(
            <<<'SQL'
                SELECT d.recipient_id, g.full_name, d.status, d.not_sent_reason, d.provider_report, d.provider_code, d.provider_reported_at, d.address, d.finished_at, d.created_at
                FROM notification_deliveries d
                LEFT JOIN guests g ON g.id = d.recipient_id
                WHERE d.type = :type AND d.source_id = :id
                ORDER BY g.full_name NULLS LAST, d.recipient_id
                SQL,
            ['type' => GuestMessageNotice::NAME, 'id' => $message->getId()->toRfc4122()],
        );

        $deliveries = Vec\map($rows, static function (array $row) use ($addresses): array {
            [$state, $reason] = self::state($row);
            $delivery = [
                'guestId' => Type\string()->coerce($row['recipient_id']),
                'name' => Type\nullable(Type\string())->coerce($row['full_name']),
                'channel' => 'email',
                'state' => $state,
                'reason' => $reason,
                'code' => Type\nullable(Type\string())->coerce($row['provider_code']),
                'at' => self::moment($row['provider_reported_at'] ?? $row['finished_at'] ?? $row['created_at']),
            ];

            return $addresses ? [...$delivery, 'address' => Type\nullable(Type\string())->coerce($row['address'])] : $delivery;
        });
        $reached = Iter\count(Vec\filter($deliveries, static fn (array $delivery): bool => Iter\contains([self::SENT, self::DELIVERED, self::REPORTED_AS_SPAM], $delivery['state'])));

        return [
            ...$this->summary($message),
            'message' => $message->getBody(),
            'reached' => $reached,
            'deliveries' => $deliveries,
            'sending' => Iter\any($deliveries, static fn (array $delivery): bool => self::QUEUED === $delivery['state']),
        ];
    }

    /** @return array<string, mixed> */
    private function summary(GuestMessage $message): array
    {
        return [
            'id' => $message->getId()->toRfc4122(),
            'subject' => $message->getSubject(),
            'firstLine' => Iter\first(Vec\filter(Vec\map(Str\split($message->getBody(), "\n"), Str\trim(...)), static fn (string $line): bool => '' !== $line)) ?? '',
            'audience' => $message->getAudience(),
            'conditions' => null === ($conditions = $message->getConditions()) ? null : $this->guestConditions->shown($message->getEvent(), $conditions),
            'channels' => ['email'],
            'sentBy' => $message->getCreatedByName(),
            'sentAt' => $message->getCreatedAt()->format(DateTimeInterface::ATOM),
            'follows' => $message->getFollows()?->getId()->toRfc4122(),
        ];
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array{0: string, 1: ?string}
     */
    private static function state(array $row): array
    {
        $status = NotificationDeliveryStatus::from(Type\string()->coerce($row['status']));
        $report = Type\nullable(Type\string())->coerce($row['provider_report']);

        return match ($status) {
            NotificationDeliveryStatus::Pending => [self::QUEUED, null],
            NotificationDeliveryStatus::Sent => match ($report) {
                MailProviderReport::Complained->value => [self::REPORTED_AS_SPAM, null],
                MailProviderReport::Bounced->value => [self::BOUNCED, null],
                MailProviderReport::Delivered->value => [self::DELIVERED, null],
                default => [self::SENT, null],
            },
            default => [self::NOT_SENT, Type\nullable(Type\string())->coerce($row['not_sent_reason']) ?? DeliveryNotSentReason::Failed->value],
        };
    }

    private static function moment(mixed $value): ?string
    {
        return null === $value ? null : new DateTimeImmutable(Type\string()->coerce($value))->format(DateTimeInterface::ATOM);
    }
}
