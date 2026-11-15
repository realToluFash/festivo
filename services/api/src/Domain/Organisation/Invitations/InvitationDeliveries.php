<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Invitations;

use App\Domain\Messaging\EmailSuppressions;
use App\Domain\Messaging\NotificationWorker;
use App\Entity\Invitation;
use App\Enum\AccountMail;
use App\Enum\MailProviderReport;
use App\Enum\NotificationDeliveryStatus;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** An invitation's send as its delivery record has it: the invitation keeps no status of its own (sc-4332). */
final readonly class InvitationDeliveries
{
    public function __construct(
        private Connection $connection,
        private EmailSuppressions $emailSuppressions,
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
     * A send still waiting to a suppressed address counts already: the worker cancels it seconds later.
     *
     * @param list<Invitation> $invitations
     *
     * @return list<string> the ids of those whose latest send could not be delivered, never why (sc-46109)
     */
    public function undelivered(array $invitations): array
    {
        $latest = $this->latest($invitations);
        $waiting = Vec\filter($invitations, static fn (Invitation $invitation): bool => NotificationDeliveryStatus::Pending === ($latest[$invitation->getId()->toRfc4122()]['status'] ?? null));
        $suppressed = $this->emailSuppressions->suppressedAmong(Vec\map($waiting, static fn (Invitation $invitation): string => $invitation->getEmail()));
        $undelivered = [];

        foreach ($invitations as $invitation) {
            $id = $invitation->getId()->toRfc4122();
            $send = $latest[$id] ?? null;

            if (null !== $send && match ($send['status']) {
                NotificationDeliveryStatus::Failed => true,
                NotificationDeliveryStatus::Cancelled => NotificationWorker::SUPPRESSED === $send['error'],
                NotificationDeliveryStatus::Sent => MailProviderReport::Bounced === $send['report'],
                NotificationDeliveryStatus::Pending => Iter\contains($suppressed, Str\lowercase(Str\trim($invitation->getEmail()))),
                default => false,
            }) {
                $undelivered[] = $id;
            }
        }

        return $undelivered;
    }

    /**
     * @param list<Invitation> $invitations
     *
     * @return array<string, array{status: NotificationDeliveryStatus, at: ?DateTimeImmutable, report: ?MailProviderReport, error: ?string}>
     */
    public function latest(array $invitations): array
    {
        if ([] === $invitations) {
            return [];
        }

        $rows = $this->connection->fetchAllAssociative(
            <<<'SQL'
                SELECT DISTINCT ON (split_part(source_id, ':', 1)) split_part(source_id, ':', 1) AS invitation, status, finished_at, provider_report, last_error
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
            $report = Type\nullable(Type\string())->coerce($row['provider_report']);
            $latest[Type\string()->coerce($row['invitation'])] = [
                'status' => NotificationDeliveryStatus::from(Type\string()->coerce($row['status'])),
                'at' => null === $at ? null : new DateTimeImmutable($at, new DateTimeZone('UTC')),
                'report' => null === $report ? null : MailProviderReport::from($report),
                'error' => Type\nullable(Type\string())->coerce($row['last_error']),
            ];
        }

        return $latest;
    }
}
