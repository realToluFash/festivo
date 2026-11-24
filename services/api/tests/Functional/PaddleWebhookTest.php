<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Billing\Catalogue\CatalogueKeeper;
use App\Domain\Billing\Command\ReconcileCommand;
use App\Domain\Billing\Model\SubscriptionState;
use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\Subscription;
use App\Entity\User;
use App\Enum\CataloguePart;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\Plan;
use App\Enum\SeededRole;
use App\Enum\SubscriptionSource;
use App\Enum\SubscriptionStatus;
use App\Integrations\Paddle\PaddleApi;
use App\Integrations\Paddle\PaddleSubscriptions;
use App\Repository\CatalogueVersionRepository;
use App\Repository\SubscriptionRepository;
use App\Tests\ApiTestCase;
use App\Tests\Double\RecordingLogger;
use App\Tests\Double\ScriptedPaymentProvider;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Ref;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use Psr\Log\LogLevel;
use SensitiveParameter;
use Symfony\Component\Clock;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

/** sc-3933: Paddle's signed webhooks are the only thing that changes what an organisation has paid for, each event once and in Paddle's order. */
final class PaddleWebhookTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';
    /** @mago-expect lint:no-literal-password */
    private const string SECRET = 'test-paddle-webhook-secret';

    private User $owner;
    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();

        self::mockTime(new DateTimeImmutable('2027-01-31T09:00:00Z'));
        $this->owner = $this->account('folake@ire.events');
        self::onboard($this->owner, withOrganisation: false);
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ire Events', 'GB', 'Europe/London');
        self::em()->flush();
    }

    #[Test]
    public function anUnsignedWronglySignedOrStaleEventIsRefusedAndChangesNothing(): void
    {
        $body = Json\encode($this->subscriptionEvent('evt_1', 'subscription.created', '2027-01-31T09:00:00Z', 'active', '2027-01-31T09:00:00Z', '2027-02-28T09:00:00Z'));
        $now = Clock\now()->getTimestamp();

        foreach (['', 'ts=' . $now . ';h1=' . Str\repeat('0', 64), $this->signature($body, $now - 301), $this->signature($body, $now, 'another secret')] as $header) {
            $this->client->request('POST', '/api/webhooks/paddle', server: '' === $header ? [] : ['HTTP_PADDLE_SIGNATURE' => $header], content: $body);
            self::assertResponseStatusCodeSame(401);
        }

        self::assertSame(SubscriptionSource::Manual, $this->subscription()->getSource());
        self::assertSame(0, self::connection()->fetchOne('SELECT count(*) FROM provider_events'));
    }

    #[Test]
    public function aRenewalOn28FebruaryKeepsThe31JanuaryPeriodStartAndWritesOnePeriodLine(): void
    {
        $this->deliver($this->subscriptionEvent('evt_created', 'subscription.created', '2027-01-31T09:00:00Z', 'active', '2027-01-31T09:00:00Z', '2027-02-28T09:00:00Z'));

        self::mockTime(new DateTimeImmutable('2027-02-28T09:00:05Z'));
        $this->deliver($this->subscriptionEvent('evt_renewed', 'subscription.updated', '2027-02-28T09:00:00Z', 'active', '2027-02-28T09:00:00Z', '2027-03-31T09:00:00Z'));

        $subscription = $this->subscription();
        self::assertSame(
            [Plan::Enterprise, SubscriptionStatus::Active, SubscriptionSource::Paddle, 'sub_1', '2027-01-31T09:00:00+00:00', '2027-03-31T09:00:00+00:00'],
            [$subscription->getPlan(), $subscription->getStatus(), $subscription->getSource(), $subscription->getExternalRef(), $subscription->getPeriodStart()->format(\DATE_ATOM), $subscription->getPeriodEnd()?->format(\DATE_ATOM)],
        );
        self::assertSame([
            ['evt_created', 'plan', 'free', 'enterprise', '2027-01-31 09:00:00'],
            ['evt_created', 'period', null, '2027-02-28T09:00:00+00:00', '2027-01-31 09:00:00'],
            ['evt_renewed', 'period', '2027-02-28T09:00:00+00:00', '2027-03-31T09:00:00+00:00', '2027-02-28 09:00:00'],
        ], $this->history());
    }

    #[Test]
    public function pastDueThenARenewalThatClearsItThenACancellationEachWriteTheirLines(): void
    {
        $this->deliver($this->subscriptionEvent('evt_created', 'subscription.created', '2027-01-31T09:00:00Z', 'active', '2027-01-31T09:00:00Z', '2027-02-28T09:00:00Z'));
        $this->deliver($this->subscriptionEvent('evt_past_due', 'subscription.past_due', '2027-02-28T09:00:00Z', 'past_due', '2027-01-31T09:00:00Z', '2027-02-28T09:00:00Z'));
        $this->deliver($this->subscriptionEvent('evt_paid', 'subscription.updated', '2027-03-01T09:00:00Z', 'active', '2027-02-28T09:00:00Z', '2027-03-31T09:00:00Z'));
        $this->deliver($this->subscriptionEvent('evt_cancelled', 'subscription.canceled', '2027-03-05T09:00:00Z', 'canceled', null, null));

        self::assertSame(SubscriptionStatus::Cancelled, $this->subscription()->getStatus());
        self::assertSame([
            ['evt_created', 'plan', 'free', 'enterprise', '2027-01-31 09:00:00'],
            ['evt_created', 'period', null, '2027-02-28T09:00:00+00:00', '2027-01-31 09:00:00'],
            ['evt_past_due', 'status', 'active', 'past_due', '2027-02-28 09:00:00'],
            ['evt_paid', 'period', '2027-02-28T09:00:00+00:00', '2027-03-31T09:00:00+00:00', '2027-03-01 09:00:00'],
            ['evt_paid', 'status', 'past_due', 'active', '2027-03-01 09:00:00'],
            ['evt_cancelled', 'status', 'active', 'cancelled', '2027-03-05 09:00:00'],
        ], $this->history());
    }

    #[Test]
    public function aRepeatIsAcknowledgedAndWritesNothingAndAnOlderEventNeverOverwritesANewerState(): void
    {
        $created = $this->subscriptionEvent('evt_created', 'subscription.created', '2027-01-31T09:00:00Z', 'active', '2027-01-31T09:00:00Z', '2027-02-28T09:00:00Z');
        $this->deliver($created);
        $this->deliver($this->subscriptionEvent('evt_cancelled', 'subscription.canceled', '2027-02-10T09:00:00Z', 'canceled', null, null));
        $this->deliver($created);
        $this->deliver($this->subscriptionEvent('evt_late', 'subscription.updated', '2027-02-01T09:00:00Z', 'active', '2027-01-31T09:00:00Z', '2027-02-28T09:00:00Z'));

        self::assertSame(SubscriptionStatus::Cancelled, $this->subscription()->getStatus());
        self::assertSame(['plan', 'period', 'status'], Vec\map($this->history(), static fn (array $line): ?string => $line[1]));
        self::assertSame(3, self::connection()->fetchOne('SELECT count(*) FROM provider_events'));
    }

    #[Test]
    public function aFailedPaymentChangesNothingAndThePaymentMethodShowsOnlyWhatPaddleReturns(): void
    {
        $this->deliver($this->subscriptionEvent('evt_created', 'subscription.created', '2027-01-31T09:00:00Z', 'active', '2027-01-31T09:00:00Z', '2027-02-28T09:00:00Z'));

        $this->deliver($this->transaction('evt_failed', 'transaction.payment_failed', 'error', ['type' => 'card', 'card' => ['type' => 'visa', 'last4' => '0002', 'expiry_month' => 3, 'expiry_year' => 2030]]));
        self::assertNull($this->paymentMethod());

        // A payment that needed 3-D Secure completes inside the checkout; Soirely only ever sees the completed transaction.
        $this->deliver($this->transaction('evt_3ds', 'transaction.completed', 'captured', ['type' => 'card', 'card' => ['type' => 'visa', 'last4' => '5556', 'expiry_month' => 3, 'expiry_year' => 2030, 'cardholder_name' => 'Folake Ade']]));
        self::assertSame(['type' => 'card', 'brand' => 'visa', 'last4' => '5556', 'expiryMonth' => 3, 'expiryYear' => 2030], $this->paymentMethod());

        $this->deliver($this->transaction('evt_unknown', 'transaction.completed', 'captured', ['type' => 'card', 'card' => ['type' => 'unknown', 'last4' => '4242', 'expiry_month' => 8, 'expiry_year' => 2028]]));
        self::assertSame(['type' => 'card', 'brand' => null, 'last4' => '4242', 'expiryMonth' => 8, 'expiryYear' => 2028], $this->paymentMethod());

        $this->deliver($this->transaction('evt_paypal', 'transaction.completed', 'captured', ['type' => 'paypal', 'card' => null]));
        self::assertSame(['type' => 'paypal', 'brand' => null, 'last4' => null, 'expiryMonth' => null, 'expiryYear' => null], $this->paymentMethod());

        $this->deliver($this->transaction('evt_other', 'transaction.completed', 'captured', ['type' => 'unknown', 'card' => null]));
        self::assertSame('other', $this->paymentMethod()['type'] ?? null);

        // A refund changes nothing here: a cancellation that follows it arrives as its own subscription.canceled.
        $this->deliver(['event_id' => 'evt_refund', 'event_type' => 'adjustment.created', 'occurred_at' => '2027-02-02T09:00:00Z', 'data' => ['id' => 'adj_1', 'action' => 'refund', 'status' => 'approved', 'transaction_id' => 'txn_evt_3ds', 'subscription_id' => 'sub_1']]);
        $this->deliver(['event_id' => 'evt_refunded', 'event_type' => 'adjustment.updated', 'occurred_at' => '2027-02-02T09:05:00Z', 'data' => ['id' => 'adj_1', 'action' => 'refund', 'status' => 'approved', 'transaction_id' => 'txn_evt_3ds', 'subscription_id' => 'sub_1']]);

        self::assertSame(SubscriptionStatus::Active, $this->subscription()->getStatus());
        self::assertSame(['plan', 'period'], Vec\map($this->history(), static fn (array $line): ?string => $line[1]));
    }

    #[Test]
    public function noCardNumberCvcOrCardholderIsStoredAnywhere(): void
    {
        $this->deliver($this->transaction('evt_card', 'transaction.completed', 'captured', ['type' => 'card', 'card' => ['type' => 'visa', 'last4' => '5556', 'expiry_month' => 3, 'expiry_year' => 2030, 'cardholder_name' => 'Folake Ade']]));

        $columns = Type\vec(Type\string())->coerce(self::connection()->fetchFirstColumn('SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema()'));
        $dump = Str\join(Vec\map(
            ['billing_accounts', 'subscriptions', 'subscription_changes', 'provider_events'],
            static fn (string $table): string => Json\encode(self::connection()->fetchAllAssociative('SELECT * FROM ' . $table)),
        ), "\n");

        self::assertSame([], Vec\filter($columns, static fn (string $column): bool => Regex\matches($column, '/card_number|^pan$|cvc|cvv|cardholder/')));
        self::assertStringNotContainsString('Folake Ade', $dump);
        self::assertStringContainsString('5556', $dump);
    }

    #[Test]
    public function aCardPaidForOneOfAFoundersOrganisationsShowsOnlyOnThatOne(): void
    {
        $other = self::service(OrganisationFounder::class)->found($this->owner, 'Ire Weddings', 'GB', 'Europe/London');
        self::em()->flush();

        foreach ([$this->organisation, $other] as $organisation) {
            self::service(SubscriptionRepository::class)->findCurrentOf($organisation->getId())->getBillingAccount()->setProviderCustomerRef('ctm_1');
        }
        self::em()->flush();

        $this->deliver($this->transaction('evt_other', 'transaction.completed', 'captured', ['type' => 'card', 'card' => ['type' => 'visa', 'last4' => '1111', 'expiry_month' => 3, 'expiry_year' => 2030]], $other, null));
        $this->deliver($this->transaction('evt_other_again', 'transaction.completed', 'captured', ['type' => 'card', 'card' => ['type' => 'visa', 'last4' => '5556', 'expiry_month' => 3, 'expiry_year' => 2030]], $other, null));

        self::assertSame([null, '5556'], [$this->paymentMethod(), $this->paymentMethod($other)['last4'] ?? null]);

        $this->deliver($this->transaction('evt_this', 'transaction.completed', 'captured', ['type' => 'card', 'card' => ['type' => 'mastercard', 'last4' => '4444', 'expiry_month' => 9, 'expiry_year' => 2031]], null, null));

        self::assertSame(['4444', '5556'], [$this->paymentMethod()['last4'] ?? null, $this->paymentMethod($other)['last4'] ?? null]);
    }

    #[Test]
    public function aCheckoutIsPricedFromTheCatalogueAndWritesNothingUntilTheProviderSaysSo(): void
    {
        $terms = self::service(CatalogueVersionRepository::class)->findOneByName(CataloguePart::Plans, '2026-10-19')?->getTerms() ?? self::fail('The first version is missing.');
        $terms['enterprise'] = ['sales' => 'self_serve'] + Type\dict(Type\string(), Type\mixed())->coerce($terms['enterprise']);
        self::service(CatalogueKeeper::class)->publish(CataloguePart::Plans, 'self-serve enterprise', $terms, 'Enterprise sold through the checkout, for this test', 'Ada at Soirely');
        $sent = $this->paddle(
            ['data' => []],
            ['data' => ['id' => 'ctm_new']],
            ['data' => [['id' => 'add_fr', 'country_code' => 'FR']]],
            ['data' => ['id' => 'add_gb']],
            ['data' => ['id' => 'txn_checkout']],
            ['data' => [['id' => 'add_gb', 'country_code' => 'GB']]],
            ['data' => ['id' => 'txn_again']],
        );
        $path = '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/billing';

        $this->signIn($this->owner);
        $this->client->jsonRequest('POST', $path . '/checkout', ['plan' => 'enterprise', 'interval' => 'year']);
        self::assertResponseStatusCodeSame(201);
        self::assertSame('txn_checkout', Json\typed((string) $this->client->getResponse()->getContent(), Type\shape(['checkout' => Type\shape(['transactionId' => Type\string()])]))['checkout']['transactionId']);

        $currency = $this->subscription()->getBillingAccount()->getCurrency();
        $yearly = [
            'customer_id' => 'ctm_new',
            'address_id' => 'add_gb',
            'currency_code' => $currency,
            'custom_data' => ['organisation_id' => $this->organisation->getId()->toRfc4122(), 'plan' => 'enterprise'],
            'items' => [[
                'quantity' => 1,
                'price' => [
                    'description' => 'enterprise year',
                    'unit_price' => ['amount' => (string) ['USD' => 249000, 'EUR' => 229000, 'GBP' => 199000][$currency], 'currency_code' => $currency],
                    'billing_cycle' => ['interval' => 'year', 'frequency' => 1],
                    'product' => ['name' => 'Soirely Enterprise', 'tax_category' => 'standard'],
                ],
            ]],
        ];
        self::assertSame(
            ['GET /customers?email=folake%40ire.events', 'POST /customers', 'GET /customers/ctm_new/addresses?status=active', 'POST /customers/ctm_new/addresses', 'POST /transactions'],
            Vec\map($sent->value, static fn (array $call): string => $call[0]),
        );
        self::assertSame([['email' => 'folake@ire.events'], ['country_code' => 'GB']], [$sent->value[1][1], $sent->value[3][1]]);
        self::assertSame($yearly, $sent->value[4][1]);

        $this->client->request('POST', $path . '/checkout', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['plan' => 'enterprise', 'interval' => 'year', 'price' => 1, 'amount' => 1, 'currency' => 'USD']));
        self::assertSame(
            [201, ['GET /customers/ctm_new/addresses?status=active', 'POST /transactions'], $yearly],
            [$this->client->getResponse()->getStatusCode(), Vec\map(Vec\drop($sent->value, 5), static fn (array $call): string => $call[0]), $sent->value[6][1] ?? null],
        );

        self::assertSame(SubscriptionSource::Manual, $this->subscription()->getSource());
        self::assertSame(Plan::Free, $this->subscription()->getPlan());
        self::assertSame(0, self::connection()->fetchOne('SELECT count(*) FROM subscription_changes'));

    }

    #[Test]
    public function aPaymentMethodPageIsTheProvidersOwnTransactionForTheSubscriptionAndWritesNothing(): void
    {
        $this->deliver($this->subscriptionEvent('evt_created', 'subscription.created', '2027-01-31T09:00:00Z', 'active', '2027-01-31T09:00:00Z', '2027-02-28T09:00:00Z'));
        $lines = $this->history();
        $sent = $this->paddle(['data' => ['id' => 'txn_update']]);

        $this->signIn($this->owner);
        $this->client->jsonRequest('POST', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/billing/payment-method');

        self::assertResponseStatusCodeSame(201);
        self::assertSame([['GET /subscriptions/sub_1/update-payment-method-transaction', null]], $sent->value);
        self::assertSame($lines, $this->history());
        self::assertNull($this->paymentMethod());
    }

    #[Test]
    public function theNightlyReconciliationReportsEachDifferenceAndEveryUndeliveredEventAndCorrectsNothing(): void
    {
        $this->deliver($this->subscriptionEvent('evt_created', 'subscription.created', '2027-01-31T09:00:00Z', 'active', '2027-01-31T09:00:00Z', '2027-02-28T09:00:00Z'));
        $before = [$this->history(), self::connection()->fetchAllAssociative('SELECT * FROM subscriptions')];
        $periodEnd = new DateTimeImmutable('2027-02-28T09:00:00Z');
        $held = static fn (Plan $plan, SubscriptionStatus $status, DateTimeImmutable $end): SubscriptionState => new SubscriptionState(SubscriptionSource::Paddle, 'sub_1', $plan, $status, $end);
        $id = $this->subscription()->getId()->toRfc4122();

        $reports = Vec\map([
            $held(Plan::Enterprise, SubscriptionStatus::Active, $periodEnd),
            $held(Plan::Free, SubscriptionStatus::Active, $periodEnd),
            $held(Plan::Enterprise, SubscriptionStatus::PastDue, $periodEnd),
            $held(Plan::Enterprise, SubscriptionStatus::Active, new DateTimeImmutable('2027-03-31T09:00:00Z')),
            null,
        ], fn (?SubscriptionState $state): array => $this->reconcile(new ScriptedPaymentProvider($state)));

        self::assertSame([
            [],
            [[LogLevel::CRITICAL, 'Billing reconciliation: subscription ' . $id . ' differs from the provider, plan enterprise here, free there.']],
            [[LogLevel::CRITICAL, 'Billing reconciliation: subscription ' . $id . ' differs from the provider, status active here, past_due there.']],
            [[LogLevel::CRITICAL, 'Billing reconciliation: subscription ' . $id . ' differs from the provider, the period end differs.']],
            [[LogLevel::CRITICAL, 'Billing reconciliation: subscription ' . $id . ' differs from the provider, the provider holds no such subscription.']],
        ], $reports);
        self::assertSame(
            [[LogLevel::CRITICAL, 'Billing: the provider gave up delivering ntf_1 after its last retry.'], [LogLevel::CRITICAL, 'Billing: the provider gave up delivering ntf_2 after its last retry.']],
            $this->reconcile(new ScriptedPaymentProvider($held(Plan::Enterprise, SubscriptionStatus::Active, $periodEnd), ['ntf_1', 'ntf_2'])),
        );
        self::assertSame($before, [$this->history(), self::connection()->fetchAllAssociative('SELECT * FROM subscriptions')]);
    }

    #[Test]
    public function anEventIsReportedUndeliveredOnceTheNightAfterPaddlesLastAttemptOnEveryPage(): void
    {
        /** @var Ref<list<array{0: string, 1: mixed}>> $sent */
        $sent = new Ref([]);
        $paddle = $this->paddleAnswering(
            $sent,
            ['data' => [['id' => 'ntf_new', 'last_attempt_at' => '2027-01-31T07:00:00Z'], ['id' => 'ntf_reported', 'last_attempt_at' => '2027-01-30T08:59:00Z']], 'meta' => ['pagination' => ['next' => 'https://paddle.test/notifications?after=ntf_reported', 'has_more' => true]]],
            ['data' => [['id' => 'ntf_late', 'last_attempt_at' => '2027-01-30T09:00:00Z']], 'meta' => ['pagination' => ['next' => 'https://paddle.test/notifications?after=ntf_late', 'has_more' => false]]],
        );

        self::assertSame(['ntf_new', 'ntf_late'], $paddle->undeliveredEvents());
        self::assertSame(
            ['GET /notifications?status=failed&per_page=200&from=2027-01-28T09%3A00%3A00%2B00%3A00', 'GET /notifications?after=ntf_reported'],
            Vec\map($sent->value, static fn (array $call): string => $call[0]),
        );
    }

    #[Test]
    public function onlyBillingManageStartsACheckoutAndAContractPlanIsNotSoldThere(): void
    {
        $admin = $this->member('admin@ire.events', SeededRole::Admin);
        $path = '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/billing';

        $this->signIn($admin);
        $this->client->jsonRequest('POST', $path . '/checkout', ['plan' => 'enterprise', 'interval' => 'month']);
        self::assertResponseStatusCodeSame(403);
        $this->client->jsonRequest('POST', $path . '/payment-method');
        self::assertResponseStatusCodeSame(403);

        $this->signIn($this->owner);
        $this->client->jsonRequest('POST', $path . '/checkout', ['plan' => 'enterprise', 'interval' => 'month']);
        self::assertSame([409, ErrorCode::PlanSoldByContract->type()], $this->refusal());
        $this->client->jsonRequest('POST', $path . '/payment-method');
        self::assertSame([409, ErrorCode::NothingPaidThroughProvider->type()], $this->refusal());
    }

    /** @return array<string, mixed> */
    private function subscriptionEvent(string $id, string $type, string $occurredAt, string $status, ?string $startsAt, ?string $endsAt): array
    {
        return [
            'event_id' => $id,
            'event_type' => $type,
            'occurred_at' => $occurredAt,
            'notification_id' => 'ntf_' . $id,
            'data' => [
                'id' => 'sub_1',
                'status' => $status,
                'customer_id' => 'ctm_1',
                'custom_data' => ['organisation_id' => $this->organisation->getId()->toRfc4122(), 'plan' => 'enterprise'],
                'current_billing_period' => null === $startsAt ? null : ['starts_at' => $startsAt, 'ends_at' => $endsAt],
            ],
        ];
    }

    /**
     * @param array<string, mixed> $methodDetails
     *
     * @return array<string, mixed>
     */
    private function transaction(string $id, string $type, string $paymentStatus, array $methodDetails, ?Organisation $soldTo = null, ?string $subscriptionRef = 'sub_1'): array
    {
        return [
            'event_id' => $id,
            'event_type' => $type,
            'occurred_at' => '2027-01-31T09:00:00Z',
            'data' => [
                'id' => 'txn_' . $id,
                'status' => 'transaction.completed' === $type ? 'completed' : 'past_due',
                'customer_id' => 'ctm_1',
                'subscription_id' => $subscriptionRef,
                'custom_data' => ['organisation_id' => ($soldTo ?? $this->organisation)->getId()->toRfc4122(), 'plan' => 'enterprise'],
                'payments' => [['status' => $paymentStatus, 'method_details' => $methodDetails]],
            ],
        ];
    }

    /** @param array<string, mixed> $event */
    private function deliver(array $event): void
    {
        $body = Json\encode($event);
        $this->client->request('POST', '/api/webhooks/paddle', server: ['HTTP_PADDLE_SIGNATURE' => $this->signature($body, Clock\now()->getTimestamp())], content: $body);

        self::assertResponseStatusCodeSame(200);
        self::em()->clear();
    }

    private function signature(string $body, int $at, #[SensitiveParameter] string $secret = self::SECRET): string
    {
        return 'ts=' . $at . ';h1=' . \hash_hmac('sha256', $at . ':' . $body, $secret);
    }

    /** @return list<array{0: string, 1: string, 2: ?string, 3: ?string, 4: string}> who, kind, from, to and when, in order */
    private function history(): array
    {
        return Type\vec(Type\shape([0 => Type\string(), 1 => Type\string(), 2 => Type\nullable(Type\string()), 3 => Type\nullable(Type\string()), 4 => Type\string()]))->coerce(self::connection()->fetchAllNumeric(
            'SELECT actor_label, kind, from_value, to_value, occurred_at FROM subscription_changes WHERE subscription_id = :id ORDER BY occurred_at, CASE kind WHEN \'plan\' THEN 0 WHEN \'period\' THEN 1 ELSE 2 END',
            ['id' => $this->subscription()->getId()->toRfc4122()],
        ));
    }

    /** @return ?array<string, mixed> */
    private function paymentMethod(?Organisation $of = null): ?array
    {
        $this->signIn($this->owner);
        $this->client->request('GET', '/api/orgs/' . ($of ?? $this->organisation)->getId()->toRfc4122() . '/billing-account');

        return Json\typed((string) $this->client->getResponse()->getContent(), Type\shape(['paymentMethod' => Type\nullable(Type\dict(Type\string(), Type\mixed()))], true))['paymentMethod'];
    }

    /**
     * Paddle, for the controllers, answering each call in turn with the next of `$answers`.
     *
     * @param array<string, mixed> ...$answers
     *
     * @return Ref<list<array{0: string, 1: mixed}>> each call as its method and path, and the JSON body it sent
     */
    private function paddle(array ...$answers): Ref
    {
        /** @var Ref<list<array{0: string, 1: mixed}>> $sent */
        $sent = new Ref([]);
        $this->client->disableReboot();
        self::getContainer()->set(PaddleApi::class, $this->paddleAnswering($sent, ...$answers));

        return $sent;
    }

    /**
     * @param Ref<list<array{0: string, 1: mixed}>> $sent
     * @param array<string, mixed> ...$answers
     */
    private function paddleAnswering(Ref $sent, array ...$answers): PaddleApi
    {
        return new PaddleApi(
            new MockHttpClient(static function (string $method, string $url, array $options) use (&$answers, $sent): MockResponse {
                $body = $options['body'] ?? '';
                $sent->value[] = [$method . ' ' . Str\strip_prefix($url, 'https://paddle.test'), '' === $body ? null : Json\decode(Type\string()->coerce($body))];

                return new MockResponse(Json\encode(\array_shift($answers) ?? self::fail('Paddle was called once too often.')), ['http_code' => 200]);
            }),
            self::em(),
            self::service(PaddleSubscriptions::class),
            self::service(ClockInterface::class),
            'https://paddle.test',
            'test-key',
        );
    }

    /** @return list<array{0: mixed, 1: string}> each line logged, as its level and message */
    private function reconcile(ScriptedPaymentProvider $provider): array
    {
        $logger = new RecordingLogger();
        $command = new ReconcileCommand(self::service(SubscriptionRepository::class), $provider, $logger);

        self::assertSame(0, $command(new SymfonyStyle(new ArrayInput([]), new BufferedOutput())));

        return Vec\map($logger->records, static fn (array $record): array => [$record['level'], $record['message']]);
    }

    /** @return array{0: int, 1: ?string} the status and the problem's type */
    private function refusal(): array
    {
        $response = $this->client->getResponse();

        return [$response->getStatusCode(), Json\typed((string) $response->getContent(), Type\shape(['type' => Type\nullable(Type\string())], true))['type']];
    }

    private function subscription(): Subscription
    {
        return self::service(SubscriptionRepository::class)->findCurrentOf($this->organisation->getId());
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Folake', self::PASSWORD)->user;
        self::em()->flush();

        return $user;
    }

    private function member(string $address, SeededRole $as): User
    {
        $user = $this->account($address);
        self::onboard($user, withOrganisation: false);
        $role = Type\instance_of(Role::class)->coerce(self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation->getId(), 'seededAs' => $as]));
        self::service(MembershipMachine::class)->join($this->organisation, $user, $role, MembershipStatus::Active, MembershipChannel::Invitation, $user);
        self::em()->flush();

        return $user;
    }

    private function signIn(User $user): void
    {
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user));
    }

    private static function connection(): Connection
    {
        return self::em()->getConnection();
    }
}
