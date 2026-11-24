<?php

declare(strict_types=1);

namespace App\Integrations\Paddle;

use App\Domain\Billing\Catalogue\Model\Price;
use App\Domain\Billing\Interfaces\PaymentProviderInterface;
use App\Domain\Billing\Model\SubscriptionState;
use App\Entity\Subscription;
use App\Enum\BillingInterval;
use App\Enum\Plan;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use RuntimeException;
use SensitiveParameter;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/** Paddle Billing's API: the sandbox until epic 552 sets production keys. The price is the catalogue's, sent as a non-catalogue item, so Paddle holds no price of its own. */
final readonly class PaddleApi implements PaymentProviderInterface
{
    public function __construct(
        private HttpClientInterface $http,
        private EntityManagerInterface $entityManager,
        private PaddleSubscriptions $paddleSubscriptions,
        private string $apiBase,
        #[SensitiveParameter]
        private string $apiKey,
    ) {
    }

    public function checkout(Subscription $subscription, Plan $plan, Price $price, BillingInterval $interval): string
    {
        $account = $subscription->getBillingAccount();

        $transaction = $this->call('POST', '/transactions', [
            'customer_id' => $this->customer($subscription),
            'currency_code' => $account->getCurrency(),
            'custom_data' => ['organisation_id' => $subscription->getOrganisation()->getId()->toRfc4122(), 'plan' => $plan->value],
            'items' => [[
                'quantity' => 1,
                'price' => [
                    'description' => $plan->value . ' ' . $interval->value,
                    'unit_price' => [
                        'amount' => (string) (BillingInterval::Month === $interval ? $price->monthly : $price->yearly),
                        'currency_code' => $account->getCurrency(),
                    ],
                    'billing_cycle' => ['interval' => $interval->value, 'frequency' => 1],
                    'product' => ['name' => 'Soirely ' . Str\capitalize($plan->value), 'tax_category' => 'standard'],
                ],
            ]],
        ]);

        return Type\shape(['id' => Type\string()], true)->coerce($transaction)['id'];
    }

    public function paymentMethodUpdate(Subscription $subscription): string
    {
        $reference = $subscription->getExternalRef() ?? throw new RuntimeException('The subscription is not paid through the provider.');
        $transaction = $this->call('GET', '/subscriptions/' . \rawurlencode($reference) . '/update-payment-method-transaction');

        return Type\shape(['id' => Type\string()], true)->coerce($transaction)['id'];
    }

    public function subscriptionState(Subscription $subscription): ?SubscriptionState
    {
        $reference = $subscription->getExternalRef();

        return null === $reference ? null : $this->paddleSubscriptions->state($this->call('GET', '/subscriptions/' . \rawurlencode($reference)));
    }

    public function undeliveredEvents(): array
    {
        $notifications = Type\vec(Type\shape(['id' => Type\string()], true))->coerce($this->call('GET', '/notifications?status=failed'));

        return Vec\map($notifications, static fn (array $notification): string => $notification['id']);
    }

    private function customer(Subscription $subscription): string
    {
        $account = $subscription->getBillingAccount();
        $known = $account->getProviderCustomerRef();

        if (null !== $known) {
            return $known;
        }

        $found = Type\vec(Type\shape(['id' => Type\string()], true))->coerce(
            $this->call('GET', '/customers?email=' . \rawurlencode($account->getContactEmail())),
        );
        $id = $found[0]['id'] ?? Type\shape(['id' => Type\string()], true)->coerce($this->call('POST', '/customers', ['email' => $account->getContactEmail()]))['id'];

        $account->setProviderCustomerRef($id);
        $this->entityManager->flush();

        return $id;
    }

    /** @param ?array<string, mixed> $body */
    private function call(string $method, string $path, ?array $body = null): mixed
    {
        if ('' === $this->apiKey) {
            throw new RuntimeException('PADDLE_API_KEY is not set.');
        }

        $options = ['auth_bearer' => $this->apiKey, 'timeout' => 10];

        if (null !== $body) {
            $options['json'] = $body;
        }

        $response = $this->http->request($method, Str\trim_right($this->apiBase, '/') . $path, $options);

        if ($response->getStatusCode() >= 300) {
            throw new RuntimeException('Paddle answered ' . $path . ' with ' . $response->getStatusCode() . '.');
        }

        return Type\shape(['data' => Type\mixed()], true)->coerce($response->toArray())['data'];
    }
}
