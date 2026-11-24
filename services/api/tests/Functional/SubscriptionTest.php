<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Deletion\Pruner;
use App\Domain\Billing\Catalogue\Catalogue;
use App\Domain\Billing\Entitlements;
use App\Domain\Billing\Model\ChangedBy;
use App\Domain\Billing\SubscriptionChanger;
use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\BillingAccount;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\Subscription;
use App\Entity\SubscriptionChange;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\Plan;
use App\Enum\PlanFeature;
use App\Enum\SeededRole;
use App\Enum\SubscriptionChangeKind;
use App\Enum\SubscriptionSource;
use App\Enum\SubscriptionStatus;
use App\Repository\SubscriptionRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\DependencyFactory;
use Doctrine\Migrations\Version\Version;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Symfony\Contracts\Cache\CacheInterface;

/** sc-3927: every organisation has one current subscription, paid for by a billing account no entitlement reads. */
final class SubscriptionTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';
    private const string BACKFILL = 'DoctrineMigrations\Version20261118230100';

    private User $owner;
    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = $this->account('folake@ire.events');
        self::onboard($this->owner, withOrganisation: false);
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ire Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
    }

    #[Test]
    public function aNewOrganisationIsOnFreeAndPaidForByItsOwnersBillingAccount(): void
    {
        $subscription = $this->subscription();

        self::assertSame(
            [Plan::Free, SubscriptionStatus::Active, SubscriptionSource::Manual, null, self::service(Catalogue::class)->inForce()->versionId->toRfc4122(), null],
            [$subscription->getPlan(), $subscription->getStatus(), $subscription->getSource(), $subscription->getPeriodEnd(), $subscription->getCatalogueVersion()->getId()->toRfc4122(), $subscription->getExternalRef()],
        );

        $account = $subscription->getBillingAccount();
        self::assertSame(['folake@ire.events', 'NGN', 'NG', null, 0], [$account->getContactEmail(), $account->getCurrency(), $account->getCountryCode(), $account->getTaxId(), $account->getCreditBalance()]);

        $this->signIn($this->owner);
        $this->client->request('GET', '/api/orgs');
        $body = Json\typed((string) $this->client->getResponse()->getContent(), Type\shape([
            'organisations' => Type\vec(Type\shape([
                'plan' => Type\string(),
                'subscription' => Type\shape(['status' => Type\string(), 'periodEnd' => Type\nullable(Type\string())]),
            ], true)),
        ], true));

        self::assertResponseIsSuccessful();
        self::assertSame([['free', ['status' => 'active', 'periodEnd' => null]]], Vec\map($body['organisations'], static fn (array $organisation): array => [$organisation['plan'], $organisation['subscription']]));
    }

    #[Test]
    public function theDatabaseHoldsOneSubscriptionPerOrganisation(): void
    {
        $account = new BillingAccount('folake@ire.events', 'NGN', 'NG');
        self::em()->persist($account);
        self::em()->persist(new Subscription($this->organisation, $account, Plan::Enterprise, $this->subscription()->getCatalogueVersion(), SubscriptionStatus::Active, SubscriptionSource::Invoice, new DateTimeImmutable()));

        $this->expectException(UniqueConstraintViolationException::class);

        self::em()->flush();
    }

    #[Test]
    public function theEntitlementIgnoresTheBillingAccountAndTheSource(): void
    {
        $entitlements = self::service(Entitlements::class);
        $subscription = $this->subscription();
        $account = $subscription->getBillingAccount();

        $account->setCurrency('EUR');
        $account->setCountryCode('PT');
        $account->setCreditBalance(5000);
        $account->setProviderCustomerRef('ctm_01');
        $account->setTaxId('PT123456789');
        self::em()->flush();
        self::service(SubscriptionChanger::class)->changePlan($subscription, Plan::Free, SubscriptionSource::Paddle, ChangedBy::staff('Ada at Soirely', 'Moved to Paddle'));
        $entitlements->forget($this->organisation->getId());

        self::assertSame(Plan::Free, $entitlements->of($this->organisation->getId())->plan);
        self::assertFalse($entitlements->of($this->organisation->getId())->unlocks(PlanFeature::EmailDomains));
    }

    #[Test]
    public function aSubscriptionChangeClearsTheCachedAnswerAtOnce(): void
    {
        $entitlements = self::service(Entitlements::class);
        self::assertSame(Plan::Free, $entitlements->of($this->organisation->getId())->plan);

        self::service(SubscriptionChanger::class)->changePlan($this->subscription(), Plan::Enterprise, SubscriptionSource::Manual, ChangedBy::staff('Ada at Soirely', 'Signed the order form'));

        self::assertSame(Plan::Enterprise, $entitlements->of($this->organisation->getId())->plan);
    }

    #[Test]
    public function aMovedPeriodStartIsRecordedInTheHistoryAndAMoveToTheSameDateIsNot(): void
    {
        $subscription = $this->subscription();
        $from = $subscription->getPeriodStart();
        $changer = self::service(SubscriptionChanger::class);

        $changer->movePeriodStart($subscription, new DateTimeImmutable('2026-12-01 09:00:00+00:00'), ChangedBy::staff('Ada at Soirely', 'Upgraded from Free'));
        $changer->movePeriodStart($subscription, new DateTimeImmutable('2026-12-01 09:00:00+00:00'), ChangedBy::staff('Ada at Soirely', 'Upgraded from Free'));
        self::em()->clear();

        $changes = self::em()->getRepository(SubscriptionChange::class)->findBy(['kind' => SubscriptionChangeKind::Period]);
        self::assertSame(
            [[$from->format(DateTimeImmutable::ATOM), '2026-12-01T09:00:00+00:00']],
            Vec\map($changes, static fn (SubscriptionChange $change): array => [$change->getFromValue(), $change->getToValue()]),
        );
        self::assertSame('2026-12-01T09:00:00+00:00', $this->subscription()->getPeriodStart()->format(DateTimeImmutable::ATOM));
    }

    #[Test]
    public function aRequestCachingTheOldPlanBeforeTheChangeCommitsIsForgotten(): void
    {
        $entitlements = self::service(Entitlements::class);
        $cache = self::getContainer()->get('cache.entitlements');
        self::assertInstanceOf(CacheInterface::class, $cache);
        $key = 'entitlement.' . $this->organisation->getId()->toRfc4122();

        self::service(SubscriptionChanger::class)->changePlan($this->subscription(), Plan::Enterprise, SubscriptionSource::Manual, ChangedBy::staff('Ada at Soirely', 'Signed the order form'), static function () use ($cache, $key): void {
            self::em()->flush();
            $cache->get($key, static fn (): array => ['plan' => Plan::Free->value, 'version' => self::service(Catalogue::class)->inForce()->versionId->toRfc4122()]);
        });

        self::assertSame(Plan::Enterprise, $entitlements->of($this->organisation->getId())->plan);
    }

    #[Test]
    public function ownersAndAdminsReadTheBillingAccountAndAMemberIsRefused(): void
    {
        $admin = $this->member('admin@ire.events', SeededRole::Admin);
        $member = $this->member('member@ire.events', SeededRole::Member);
        $path = '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/billing-account';

        foreach ([$this->owner, $admin] as $reader) {
            $this->signIn($reader);
            $this->client->request('GET', $path);

            self::assertResponseIsSuccessful();
            self::assertSame(
                ['contactEmail' => 'folake@ire.events', 'currency' => 'NGN', 'countryCode' => 'NG', 'taxId' => null, 'creditBalance' => 0, 'paymentMethod' => null],
                Json\decode((string) $this->client->getResponse()->getContent()),
            );
        }

        $this->signIn($member);
        $this->client->request('GET', $path);
        $body = Json\typed((string) $this->client->getResponse()->getContent(), Type\shape(['type' => Type\string()], true));

        self::assertResponseStatusCodeSame(403);
        self::assertSame(ErrorCode::PermissionRequired->type(), $body['type']);

        $this->client->request('GET', '/api/orgs');
        self::assertResponseIsSuccessful('the plan and status stay any member\'s to read');
    }

    #[Test]
    public function theBackfillGivesAnOrganisationItsSubscriptionOnceHoweverOftenItRuns(): void
    {
        $later = $this->member('later-owner@ire.events', SeededRole::Owner);
        $connection = self::em()->getConnection();
        $id = $this->organisation->getId()->toRfc4122();
        $accountId = $this->subscription()->getBillingAccount()->getId()->toRfc4122();

        $connection->executeStatement("ALTER TABLE organisations ADD plan VARCHAR(20) DEFAULT 'free' NOT NULL");
        $connection->executeStatement('ALTER TABLE subscriptions ALTER catalogue_version_id DROP NOT NULL');
        $connection->executeStatement("UPDATE organisations SET plan = 'enterprise' WHERE id = :id", ['id' => $id]);
        $connection->executeStatement('DELETE FROM subscriptions WHERE organisation_id = :id', ['id' => $id]);
        $connection->executeStatement('DELETE FROM billing_accounts WHERE id = :id', ['id' => $accountId]);
        self::em()->clear();

        $count = static fn (): array => [
            (int) $connection->fetchOne('SELECT COUNT(*) FROM subscriptions'),
            (int) $connection->fetchOne('SELECT COUNT(*) FROM billing_accounts'),
        ];
        $before = $count();

        $this->backfill();
        $once = $count();
        $this->backfill();

        self::assertSame([$before[0] + 1, $before[1] + 1], $once);
        self::assertSame($once, $count(), 'a second run creates nothing');
        self::assertSame(1, (int) $connection->fetchOne('SELECT COUNT(*) FROM subscriptions WHERE organisation_id = :id', ['id' => $id]));

        // As sc-3928's migration does next, before the column is made NOT NULL again.
        $connection->executeStatement("UPDATE subscriptions SET catalogue_version_id = (SELECT id FROM catalogue_versions WHERE part = 'plans' AND name = '2026-10-19') WHERE catalogue_version_id IS NULL");

        $subscription = $this->subscription();
        self::assertSame(
            [Plan::Enterprise, SubscriptionStatus::Active, SubscriptionSource::Manual, null],
            [$subscription->getPlan(), $subscription->getStatus(), $subscription->getSource(), $subscription->getPeriodEnd()],
        );
        $account = $subscription->getBillingAccount();
        self::assertSame(['folake@ire.events', 'NGN', 'NG'], [$account->getContactEmail(), $account->getCurrency(), $account->getCountryCode()], 'the earliest-joined owner, not ' . $later->getName());
    }

    #[Test]
    public function anOrganisationsPurgeTakesTheBillingAccountOnlyItWasPaidBy(): void
    {
        $kept = self::service(OrganisationFounder::class)->found($this->owner, 'Ire Weddings', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $connection = self::em()->getConnection();
        $purged = $this->subscription()->getBillingAccount()->getId()->toRfc4122();
        $keeps = self::service(SubscriptionRepository::class)->findCurrentOf($kept->getId())->getBillingAccount()->getId()->toRfc4122();

        $connection->executeStatement("UPDATE organisations SET deleted_at = '2000-01-01' WHERE id = :id", ['id' => $this->organisation->getId()->toRfc4122()]);
        self::em()->clear();
        self::service(Pruner::class)->prune();

        self::assertSame([0, 1], [
            (int) $connection->fetchOne('SELECT COUNT(*) FROM billing_accounts WHERE id = :id', ['id' => $purged]),
            (int) $connection->fetchOne('SELECT COUNT(*) FROM billing_accounts WHERE id = :id', ['id' => $keeps]),
        ]);
    }

    private function backfill(): void
    {
        $factory = self::serviceById('doctrine.migrations.dependency_factory', DependencyFactory::class);
        $migration = $factory->getMigrationRepository()->getMigration(new Version(self::BACKFILL))->getMigration();
        $migration->up(new Schema());

        foreach ($migration->getSql() as $query) {
            self::em()->getConnection()->executeStatement($query->getStatement());
        }

        self::em()->clear();
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
}
