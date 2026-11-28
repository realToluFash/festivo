<?php

declare(strict_types=1);

namespace App\Domain\Budget\Reminder;

use App\Domain\Budget\Http\QuoteSerialiser;
use App\Entity\Event;
use App\Entity\User;
use App\Enum\Permission;
use App\Enum\PlanFeature;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use App\Http\Access\Interfaces\PlanFeaturesInterface;
use App\Locale\Money;
use App\Repository\EventRepository;
use App\Repository\ScheduledPaymentRepository;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Connection;
use Psl\Dict;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/**
 * The payments one reminder named, as they are now, and only on the events where the reader holds the budget now (sc-1331). Opening it changes nothing.
 *
 * @phpstan-import-type Payment from QuoteSerialiser
 *
 * @phpstan-type DueEvent array{id: string, name: string, currency: string, today: string}
 * @phpstan-type DueRow array{paymentId: string, eventId: string, vendor: string, description: string, amount: string, payment: ?Payment}
 * @phpstan-type Sheet array{sentOn: string, readOnly: bool, events: list<DueEvent>, rows: list<DueRow>}
 */
final readonly class DueNow
{
    public function __construct(
        private Connection $connection,
        private EventRepository $eventRepository,
        private ScheduledPaymentRepository $scheduledPaymentRepository,
        private MembershipDirectoryInterface $membershipDirectory,
        private PlanFeaturesInterface $planFeatures,
        private ClockInterface $clock,
    ) {
    }

    /** @return ?Sheet null alike for a reminder that does not exist and for one with nothing left the reader may see */
    public function of(string $sendId, User $reader): ?array
    {
        if (!Uuid::isValid($sendId)) {
            return null;
        }

        $sentAt = $this->connection->fetchOne('SELECT sent_at FROM payment_reminder_sends WHERE id = :id', ['id' => $sendId]);

        if (false === $sentAt) {
            return null;
        }

        $named = Type\vec(Type\shape([
            'payment_id' => Type\string(),
            'event_id' => Type\string(),
            'vendor_name' => Type\string(),
            'description' => Type\string(),
            'amount_minor' => Type\int(),
        ]))->coerce($this->connection->fetchAllAssociative(
            'SELECT payment_id, event_id, vendor_name, description, amount_minor FROM payment_reminder_send_rows WHERE send_id = :id ORDER BY position',
            ['id' => $sendId],
        ));

        $now = $this->clock->now();
        $events = [];

        foreach (Vec\unique(Vec\map($named, static fn (array $row): string => $row['event_id'])) as $eventId) {
            $event = $this->eventRepository->find($eventId);

            if (null !== $event && true === $this->membershipDirectory->grantsOnEvent($reader, $event->getOrganisation()->getId(), $event->getId())?->holds(Permission::BudgetManage)) {
                $events[$eventId] = $event;
            }
        }

        $named = Vec\filter($named, static fn (array $row): bool => Iter\contains_key($events, $row['event_id']));

        if ([] === $named) {
            return null;
        }

        $today = Dict\map($events, static fn (Event $event): string => $now->setTimezone(new DateTimeZone($event->getTimeZone()))->format('Y-m-d'));
        $first = $events[$named[0]['event_id']];

        return [
            'sentOn' => new DateTimeImmutable(Type\string()->coerce($sentAt), new DateTimeZone('UTC'))->setTimezone(new DateTimeZone($first->getTimeZone()))->format('Y-m-d'),
            'readOnly' => Iter\any($events, fn (Event $event): bool => !$this->planFeatures->unlocks($event->getOrganisation()->getId(), PlanFeature::Vendors)),
            'events' => Vec\map(
                Vec\unique(Vec\map($named, static fn (array $row): string => $row['event_id'])),
                static fn (string $id): array => ['id' => $id, 'name' => $events[$id]->getName(), 'currency' => $events[$id]->getCurrency(), 'today' => $today[$id]],
            ),
            'rows' => Vec\map($named, function (array $row) use ($events, $today): array {
                $payment = $this->scheduledPaymentRepository->find($row['payment_id']);
                $event = $events[$row['event_id']];

                return [
                    'paymentId' => $row['payment_id'],
                    'eventId' => $row['event_id'],
                    'vendor' => $row['vendor_name'],
                    'description' => $row['description'],
                    'amount' => Money::written($row['amount_minor'], $event->getCurrency()),
                    'payment' => null === $payment ? null : QuoteSerialiser::payment($payment, $event->getCurrency(), $today[$row['event_id']]),
                ];
            }),
        ];
    }
}
