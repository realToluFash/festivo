<?php

declare(strict_types=1);

namespace App\Domain\Budget\Reminder;

use App\Entity\ScheduledPayment;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Psl\Str;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** The record a reminder's link opens (sc-1331). Its id comes from the person, the day and the payments, so the bell, the push and the email of one message, and a retry of any of them, share it. */
final readonly class PaymentReminderSends
{
    private const string NAMESPACE = '6f1c2b0e-8a43-4d6f-9b5e-2f1d7c3a9e41';

    public function __construct(
        private Connection $connection,
        private ClockInterface $clock,
    ) {
    }

    /** @param non-empty-list<ScheduledPayment> $payments in the reminder's order */
    public function record(Uuid $recipient, array $payments): Uuid
    {
        $now = $this->clock->now();
        $id = Uuid::v5(Uuid::fromString(self::NAMESPACE), Str\join([
            $recipient->toRfc4122(),
            $now->format('Y-m-d'),
            ...Vec\map($payments, static fn (ScheduledPayment $payment): string => $payment->getId()->toRfc4122()),
        ], ' '));

        $this->connection->transactional(function () use ($id, $now, $payments): void {
            $written = $this->connection->executeStatement(
                'INSERT INTO payment_reminder_sends (id, sent_at) VALUES (:id, :now) ON CONFLICT (id) DO NOTHING',
                ['id' => $id->toRfc4122(), 'now' => $now],
                ['now' => Types::DATETIME_IMMUTABLE],
            );

            if (0 === $written) {
                return;
            }

            foreach ($payments as $position => $payment) {
                $engagement = $payment->getEngagement();
                $this->connection->insert('payment_reminder_send_rows', [
                    'send_id' => $id->toRfc4122(),
                    'position' => $position,
                    'payment_id' => $payment->getId()->toRfc4122(),
                    'event_id' => $engagement->getEvent()->getId()->toRfc4122(),
                    'vendor_name' => $engagement->getVendor()->getName(),
                    'description' => $payment->getDescription(),
                    'amount_minor' => $payment->getAmountMinor(),
                ]);
            }
        });

        return $id;
    }
}
