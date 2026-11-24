<?php

declare(strict_types=1);

namespace App\Integrations\Paddle;

use App\Domain\Billing\Catalogue\Model\Price;
use App\Domain\Billing\Interfaces\PaymentProviderInterface;
use App\Domain\Billing\Model\SubscriptionState;
use App\Entity\Subscription;
use App\Enum\BillingInterval;
use App\Enum\Plan;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Str;
use Psl\Type;
use Psr\Clock\ClockInterface;
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
        private ClockInterface $clock,
        private string $apiBase,
        #[SensitiveParameter]
        private string $apiKey,
    ) {
    }

    public function checkout(Subscription $subscription, Plan $plan, Price $price, BillingInterval $interval): string
    {
        $account = $subscription->getBillingAccount();
        $customer = $this->customer($subscription);

        $transaction = $this->call('POST', '/transactions', [
            'customer_id' => $customer,
            'address_id' => $this->address($customer, $account->getCountryCode()),
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

    /** Those whose last attempt was in the day before this nightly run, so each is reported once. Paddle's own retries end within two days of the first (Webhooks, "Retry policy"). */
    public function undeliveredEvents(): array
    {
        $now = $this->clock->now();
        $since = $now->modify('-1 day');
        $path = '/notifications?status=failed&per_page=200&from=' . \rawurlencode($now->modify('-3 days')->format(\DATE_RFC3339));
        $undelivered = [];

        do {
            $page = Type\shape([
                'data' => Type\vec(Type\shape(['id' => Type\string(), 'last_attempt_at' => Type\nullable(Type\string())], true)),
                'meta' => Type\shape(['pagination' => Type\shape(['next' => Type\nullable(Type\string()), 'has_more' => Type\bool()], true)], true),
            ], true)->coerce($this->request('GET', $path));

            foreach ($page['data'] as $notification) {
                if (null !== $notification['last_attempt_at'] && new DateTimeImmutable($notification['last_attempt_at']) >= $since) {
                    $undelivered[] = $notification['id'];
                }
            }

            $next = $page['meta']['pagination']['next'];
            $path = $page['meta']['pagination']['has_more'] && null !== $next ? Str\strip_prefix($next, Str\trim_right($this->apiBase, '/')) : null;
        } while (null !== $path);

        return $undelivered;
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

    /** Tax is worked out from the country Soirely holds for the account, not one the buyer types into the checkout. */
    private function address(string $customer, string $countryCode): string
    {
        $path = '/customers/' . \rawurlencode($customer) . '/addresses';
        $addresses = Type\vec(Type\shape(['id' => Type\string(), 'country_code' => Type\string()], true))->coerce($this->call('GET', $path . '?status=active'));

        foreach ($addresses as $address) {
            if ($countryCode === $address['country_code']) {
                return $address['id'];
            }
        }

        return Type\shape(['id' => Type\string()], true)->coerce($this->call('POST', $path, ['country_code' => $countryCode]))['id'];
    }

    /** @param ?array<string, mixed> $body */
    private function call(string $method, string $path, ?array $body = null): mixed
    {
        return Type\shape(['data' => Type\mixed()], true)->coerce($this->request($method, $path, $body))['data'];
    }

    /**
     * @param ?array<string, mixed> $body
     *
     * @return array<array-key, mixed>
     */
    private function request(string $method, string $path, ?array $body = null): array
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

        return $response->toArray();
    }
}
