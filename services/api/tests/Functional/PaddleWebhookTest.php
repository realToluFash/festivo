<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\Subscription;
use App\Entity\User;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\Plan;
use App\Enum\SeededRole;
use App\Enum\SubscriptionSource;
use App\Enum\SubscriptionStatus;
use App\Repository\SubscriptionRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;

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
        $account = $this->subscription()->getBillingAccount();
        $account->setProviderCustomerRef('ctm_1');
        self::em()->flush();

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

        self::assertSame(SubscriptionStatus::Active, $this->subscription()->getStatus());
    }

    #[Test]
    public function noCardNumberCvcOrCardholderIsStoredAnywhere(): void
    {
        $this->subscription()->getBillingAccount()->setProviderCustomerRef('ctm_1');
        self::em()->flush();
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
        self::assertResponseStatusCodeSame(409, 'Enterprise is sold by contract');
        $this->client->jsonRequest('POST', $path . '/payment-method');
        self::assertResponseStatusCodeSame(409, 'nothing is paid through the provider yet');
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
    private function transaction(string $id, string $type, string $paymentStatus, array $methodDetails): array
    {
        return [
            'event_id' => $id,
            'event_type' => $type,
            'occurred_at' => '2027-01-31T09:00:00Z',
            'data' => [
                'id' => 'txn_' . $id,
                'status' => 'transaction.completed' === $type ? 'completed' : 'past_due',
                'customer_id' => 'ctm_1',
                'subscription_id' => 'sub_1',
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
    private function paymentMethod(): ?array
    {
        $this->signIn($this->owner);
        $this->client->request('GET', '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/billing-account');

        return Json\typed((string) $this->client->getResponse()->getContent(), Type\shape(['paymentMethod' => Type\nullable(Type\dict(Type\string(), Type\mixed()))], true))['paymentMethod'];
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
