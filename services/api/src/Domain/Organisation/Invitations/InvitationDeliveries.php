<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Invitations;

use App\Entity\Invitation;
use App\Enum\AccountMail;
use App\Enum\NotificationDeliveryStatus;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** An invitation's send as its delivery record has it: the invitation keeps no status of its own (sc-4332). */
final readonly class InvitationDeliveries
{
    public function __construct(
        private Connection $connection,
    ) {
    }

    public static function source(Invitation $invitation): string
    {
        return $invitation->getId()->toRfc4122() . ':' . Uuid::v7()->toRfc4122();
    }

    /**
     * @param list<Invitation> $invitations
     *
     * @return array<string, DateTimeImmutable> when each one's latest send went, absent while it waits or after it failed
     */
    public function sentAt(array $invitations): array
    {
        $sent = [];

        foreach ($this->latest($invitations) as $id => $latest) {
            if (NotificationDeliveryStatus::Sent === $latest['status'] && null !== $latest['at']) {
                $sent[$id] = $latest['at'];
            }
        }

        return $sent;
    }

    /**
     * @param list<Invitation> $invitations
     *
     * @return array<string, array{status: NotificationDeliveryStatus, at: ?DateTimeImmutable}>
     */
    public function latest(array $invitations): array
    {
        if ([] === $invitations) {
            return [];
        }

        $rows = $this->connection->fetchAllAssociative(
            <<<'SQL'
                SELECT DISTINCT ON (split_part(source_id, ':', 1)) split_part(source_id, ':', 1) AS invitation, status, finished_at
                FROM notification_deliveries
                WHERE type = :type AND split_part(source_id, ':', 1) IN (:ids)
                ORDER BY split_part(source_id, ':', 1), created_at DESC, id DESC
                SQL,
            [
                'type' => AccountMail::Invitation->typeName(),
                'ids' => Vec\map($invitations, static fn (Invitation $invitation): string => $invitation->getId()->toRfc4122()),
            ],
            ['ids' => ArrayParameterType::STRING],
        );

        $latest = [];

        foreach ($rows as $row) {
            $at = Type\nullable(Type\string())->coerce($row['finished_at']);
            $latest[Type\string()->coerce($row['invitation'])] = [
                'status' => NotificationDeliveryStatus::from(Type\string()->coerce($row['status'])),
                'at' => null === $at ? null : new DateTimeImmutable($at, new DateTimeZone('UTC')),
            ];
        }

        return $latest;
    }
}
