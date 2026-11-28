<?php

declare(strict_types=1);

namespace App\Integrations\Paddle;

use App\Domain\Billing\Model\SubscriptionState;
use App\Enum\Plan;
use App\Enum\SubscriptionSource;
use App\Enum\SubscriptionStatus;
use DateTimeImmutable;
use Psl\Type;

/** Paddle's subscription entity, as its API and its `subscription.*` events give it, in the shape every adapter normalises into. */
final readonly class PaddleSubscriptions
{
    /**
     * @param bool $billedFromStart true for a subscription Paddle has just begun billing, whose period start is its first period's
     *
     * @return ?SubscriptionState null for a status Soirely has no state for, such as paused
     */
    public function state(mixed $data, bool $billedFromStart = false): ?SubscriptionState
    {
        $subscription = Type\shape([
            'id' => Type\string(),
            'status' => Type\string(),
            'custom_data' => Type\nullable(Type\dict(Type\string(), Type\mixed())),
            'current_billing_period' => Type\nullable(Type\shape([
                'starts_at' => Type\string(),
                'ends_at' => Type\string(),
            ], true)),
        ], true)->coerce($data);

        $status = match ($subscription['status']) {
            'active', 'trialing' => SubscriptionStatus::Active,
            'past_due' => SubscriptionStatus::PastDue,
            'canceled' => SubscriptionStatus::Cancelled,
            default => null,
        };
        $plan = Plan::tryFrom(Type\string()->coerce($subscription['custom_data']['plan'] ?? ''));

        if (null === $status || null === $plan) {
            return null;
        }

        $period = $subscription['current_billing_period'];

        return new SubscriptionState(
            SubscriptionSource::Paddle,
            $subscription['id'],
            $plan,
            $status,
            null === $period ? null : new DateTimeImmutable($period['ends_at']),
            null !== $period && $billedFromStart ? new DateTimeImmutable($period['starts_at']) : null,
        );
    }
}
