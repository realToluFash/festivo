<?php

declare(strict_types=1);

namespace App\Integrations\Paddle;

use App\Domain\Billing\Model\ChangedBy;
use App\Domain\Billing\SubscriptionChanger;
use App\Entity\BillingAccount;
use App\Enum\PaymentMethodType;
use App\Repository\SubscriptionRepository;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** Its id is stored in the same transaction as what it changes, so a repeat changes nothing and a failed event leaves nothing for the retry to trip over. */
final readonly class PaddleEvents
{
    private const array SUBSCRIPTION_EVENTS = [
        'subscription.created',
        'subscription.activated',
        'subscription.updated',
        'subscription.past_due',
        'subscription.canceled',
        'subscription.resumed',
    ];

    public function __construct(
        private EntityManagerInterface $entityManager,
        private SubscriptionRepository $subscriptionRepository,
        private SubscriptionChanger $subscriptionChanger,
        private PaddleSubscriptions $paddleSubscriptions,
        private ClockInterface $clock,
    ) {
    }

    /** @return bool false for an event id already applied */
    public function receive(mixed $payload): bool
    {
        $event = Type\shape([
            'event_id' => Type\string(),
            'event_type' => Type\string(),
            'occurred_at' => Type\string(),
            'data' => Type\mixed(),
        ], true)->coerce($payload);
        $occurredAt = new DateTimeImmutable($event['occurred_at']);

        return $this->entityManager->wrapInTransaction(function () use ($event, $occurredAt): bool {
            $stored = $this->entityManager->getConnection()->executeStatement(
                'INSERT INTO provider_events (event_id, event_type, occurred_at, received_at) VALUES (:id, :type, :occurred, :received) ON CONFLICT (event_id) DO NOTHING',
                ['id' => $event['event_id'], 'type' => $event['event_type'], 'occurred' => $occurredAt, 'received' => $this->clock->now()],
                ['occurred' => Types::DATETIME_IMMUTABLE, 'received' => Types::DATETIME_IMMUTABLE],
            );

            if (0 === $stored) {
                return false;
            }

            if (Iter\contains(self::SUBSCRIPTION_EVENTS, $event['event_type'])) {
                $this->subscription($event['event_id'], $event['event_type'], $occurredAt, $event['data']);
            } elseif ('transaction.completed' === $event['event_type']) {
                $this->paymentMethod($event['data']);
            }

            return true;
        });
    }

    private function subscription(string $eventId, string $type, DateTimeImmutable $occurredAt, mixed $data): void
    {
        $organisationId = Type\shape([
            'custom_data' => Type\optional(Type\nullable(Type\shape(['organisation_id' => Type\optional(Type\string())], true))),
        ], true)->coerce($data)['custom_data']['organisation_id'] ?? null;
        $state = $this->paddleSubscriptions->state($data, 'subscription.created' === $type);

        if (null === $organisationId || !Uuid::isValid($organisationId) || null === $state) {
            return;
        }

        $this->subscriptionChanger->apply(
            $this->subscriptionRepository->findCurrentOf(Uuid::fromString($organisationId)),
            $state,
            ChangedBy::provider($eventId, $occurredAt),
        );
    }

    /** Paddle gives a card's details only for a card, and a wallet's name alone (Transactions, `payments[].method_details`). */
    private function paymentMethod(mixed $data): void
    {
        $transaction = Type\shape([
            'customer_id' => Type\optional(Type\nullable(Type\string())),
            'payments' => Type\optional(Type\vec(Type\shape([
                'status' => Type\string(),
                'method_details' => Type\optional(Type\nullable(Type\shape([
                    'type' => Type\string(),
                    'card' => Type\optional(Type\nullable(Type\shape([
                        'type' => Type\string(),
                        'last4' => Type\string(),
                        'expiry_month' => Type\int(),
                        'expiry_year' => Type\int(),
                    ], true))),
                ], true))),
            ], true))),
        ], true)->coerce($data);

        $customer = $transaction['customer_id'] ?? null;
        $account = null === $customer ? null : $this->entityManager->getRepository(BillingAccount::class)->findOneBy(['providerCustomerRef' => $customer]);
        $details = null;

        foreach ($transaction['payments'] ?? [] as $payment) {
            if ('captured' === $payment['status'] && null !== ($payment['method_details'] ?? null)) {
                $details = $payment['method_details'];
                break;
            }
        }

        if (null === $account || null === $details) {
            return;
        }

        $type = match ($details['type']) {
            'card' => PaymentMethodType::Card,
            'paypal' => PaymentMethodType::PayPal,
            'apple_pay' => PaymentMethodType::ApplePay,
            'google_pay' => PaymentMethodType::GooglePay,
            default => PaymentMethodType::Other,
        };
        $card = PaymentMethodType::Card === $type ? ($details['card'] ?? null) : null;

        if (null === $card) {
            $account->setPaymentMethod($type);
        } else {
            $account->setPaymentMethod($type, 'unknown' === $card['type'] ? null : Str\slice($card['type'], 0, 20), Str\slice($card['last4'], 0, 4), $card['expiry_month'], $card['expiry_year']);
        }
        $this->entityManager->flush();
    }
}
