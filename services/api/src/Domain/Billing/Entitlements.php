<?php

declare(strict_types=1);

namespace App\Domain\Billing;

use App\Domain\Billing\Model\Entitlement;
use App\Enum\Plan;
use App\Repository\SubscriptionRepository;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

/** The one answer to "what is this organisation entitled to?" (sc-3927). It reads the current subscription and nothing else: never the billing account, never its source. */
final readonly class Entitlements
{
    public const int TTL_SECONDS = 60;

    public function __construct(
        private SubscriptionRepository $subscriptionRepository,
        private CacheInterface $entitlementsCache,
    ) {
    }

    public function of(Uuid $organisationId): Entitlement
    {
        $plan = $this->entitlementsCache->get(self::key($organisationId), function (ItemInterface $item) use ($organisationId): string {
            $item->expiresAfter(self::TTL_SECONDS);

            return $this->subscriptionRepository->findCurrentOf($organisationId)->getPlan()->value;
        });

        return new Entitlement(Plan::from($plan));
    }

    public function forget(Uuid $organisationId): void
    {
        $this->entitlementsCache->delete(self::key($organisationId));
    }

    private static function key(Uuid $organisationId): string
    {
        return 'entitlement.' . $organisationId->toRfc4122();
    }
}
