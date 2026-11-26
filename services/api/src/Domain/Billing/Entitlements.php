<?php

declare(strict_types=1);

namespace App\Domain\Billing;

use App\Domain\Billing\Catalogue\Catalogue;
use App\Domain\Billing\Model\Entitlement;
use App\Enum\Plan;
use App\Repository\SubscriptionRepository;
use Psl\Type;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

/** The one answer to "what is this organisation entitled to?" (sc-3927): the current subscription's plan, on the catalogue version it was sold on (sc-3928). Never the billing account, never its source. */
final readonly class Entitlements
{
    public const int TTL_SECONDS = 60;

    public function __construct(
        private SubscriptionRepository $subscriptionRepository,
        private CacheInterface $entitlementsCache,
        private Catalogue $catalogue,
    ) {
    }

    public function of(Uuid $organisationId): Entitlement
    {
        $held = Type\shape(['plan' => Type\backed_enum(Plan::class), 'version' => Type\string()])->coerce($this->entitlementsCache->get(self::key($organisationId), function (ItemInterface $item) use ($organisationId): array {
            $item->expiresAfter(self::TTL_SECONDS);
            $subscription = $this->subscriptionRepository->findCurrentOf($organisationId);

            return ['plan' => $subscription->getPlan()->value, 'version' => $subscription->getCatalogueVersion()->getId()->toRfc4122()];
        }));

        return new Entitlement($this->catalogue->plansVersion(Uuid::fromString($held['version']))->plan($held['plan']));
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
