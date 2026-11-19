<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Audit\Auditor;
use App\Domain\Billing\Entitlements;
use App\Domain\Billing\SubscriptionChanger;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Organisation\Plan\EnterpriseSettings;
use App\Domain\Organisation\Plan\PlanChanger;
use App\Domain\Organisation\Plan\PlanDowngradeMailer;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Organisation;
use App\Entity\SubscriptionChange;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\ErrorCode;
use App\Enum\Plan;
use App\Enum\PlanFeature;
use App\Enum\SubscriptionChangeKind;
use App\Enum\SubscriptionSource;
use App\Repository\SubscriptionRepository;
use App\Tests\ApiTestCase;
use App\Tests\Double\ConfiguredEnterpriseSetting;
use App\Tests\Traits\OnboardsAccounts;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Type;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use RuntimeException;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;
use Symfony\Component\Mime\Email;

/** sc-581: an organisation's plan, set only by staff, audited, and a downgrade that switches settings off and keeps them. */
final class OrganisationPlanTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';
    private const string SUBJECT = 'Ire Events is on the free plan';
    private const string REASON = 'Signed the Enterprise order form';

    private User $owner;
    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = self::service(UserRegistrar::class)->register('folake@ire.events', 'Folake', self::PASSWORD)->user;
        self::onboard($this->owner, withOrganisation: false);
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ire Events', 'NG', 'Africa/Lagos');
        self::service(EntityManagerInterface::class)->flush();
    }

    #[Test]
    public function aNewOrganisationStartsOnFreeAndItsResourceSaysSo(): void
    {
        self::assertSame(Plan::Free, $this->plan());

        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($this->owner));
        $this->client->request('GET', '/api/orgs');
        $body = Json\typed((string) $this->client->getResponse()->getContent(), Type\shape([
            'organisations' => Type\vec(Type\shape(['plan' => Type\string()], true)),
        ], true));

        self::assertResponseIsSuccessful();
        self::assertSame(['free'], Vec\map($body['organisations'], static fn (array $organisation): string => $organisation['plan']));
    }

    #[Test]
    public function staffSetThePlanAndTheChangeIsAuditedWithWhoWhenAndBothPlans(): void
    {
        $tester = new CommandTester(new Application(self::$kernel ?? self::fail('no kernel'))->find('app:set-plan'));

        self::assertSame(Command::SUCCESS, $tester->execute([
            'organisation' => $this->organisation->getId()->toRfc4122(),
            'plan' => 'enterprise',
            '--agent' => 'Ada at Soirely',
            '--reason' => self::REASON,
        ]));

        $entityManager = self::service(EntityManagerInterface::class);
        $entityManager->clear();
        self::assertSame(Plan::Enterprise, $this->plan());

        $entry = $entityManager->getRepository(AuditEntry::class)->findOneBy(['action' => PlanChanger::CHANGED, 'subjectId' => $this->organisation->getId()]) ?? self::fail('no audit entry');
        self::assertSame(Actor::Agent, $entry->getActorType());
        self::assertSame('Ada at Soirely', $entry->getActorLabel());
        self::assertSame(['plan' => ['free', 'enterprise'], 'reason' => [null, self::REASON]], $entry->getChanges());

        $subscription = self::service(SubscriptionRepository::class)->findCurrentOf($this->organisation->getId());
        self::assertSame(SubscriptionSource::Manual, $subscription->getSource());
        $change = $entityManager->getRepository(SubscriptionChange::class)->findOneBy(['subscription' => $subscription->getId()]) ?? self::fail('no subscription change');
        self::assertSame([SubscriptionChangeKind::Plan, 'free', 'enterprise', Actor::Agent, 'Ada at Soirely', self::REASON], [
            $change->getKind(),
            $change->getFromValue(),
            $change->getToValue(),
            $change->getActorType(),
            $change->getActorLabel(),
            $change->getReason(),
        ]);
        self::assertNotNull($change->getOccurredAt());
    }

    #[Test]
    public function aChangeWithNoReasonIsRefusedAndChangesNothing(): void
    {
        $tester = new CommandTester(new Application(self::$kernel ?? self::fail('no kernel'))->find('app:set-plan'));

        self::assertSame(Command::FAILURE, $tester->execute([
            'organisation' => $this->organisation->getId()->toRfc4122(),
            'plan' => 'enterprise',
            '--agent' => 'Ada at Soirely',
        ]));
        self::assertSame(Plan::Free, $this->plan());
    }

    #[Test]
    public function aChangeWithNobodyNamedIsRefusedAndChangesNothing(): void
    {
        $tester = new CommandTester(new Application(self::$kernel ?? self::fail('no kernel'))->find('app:set-plan'));

        self::assertSame(Command::FAILURE, $tester->execute([
            'organisation' => $this->organisation->getId()->toRfc4122(),
            'plan' => 'enterprise',
            '--reason' => self::REASON,
        ]));
        self::assertSame(Plan::Free, $this->plan());
    }

    #[Test]
    public function aDowngradeSwitchesConfiguredSettingsOffKeepsThemAndEmailsTheAdministrators(): void
    {
        $this->owner->setTimezone('Africa/Lagos');
        self::service(EntityManagerInterface::class)->flush();
        $domains = new ConfiguredEnterpriseSetting(PlanFeature::EmailDomains, 'ire.events');
        $auditLog = new ConfiguredEnterpriseSetting(PlanFeature::AuditLog);
        $settings = $this->settings([$domains, $auditLog]);
        $changer = $this->changer($settings);
        $changer->change($this->organisation, Plan::Enterprise, 'Ada at Soirely', self::REASON);
        self::assertTrue($settings->inForce($this->organisation, PlanFeature::EmailDomains));
        self::assertFalse($settings->inForce($this->organisation, PlanFeature::AuditLog), 'unlocked, and nothing configured to apply');
        self::assertSame([], $this->mails(), 'an upgrade emails nobody');

        self::assertSame([PlanFeature::EmailDomains], $changer->change($this->organisation, Plan::Free, 'Ada at Soirely', self::REASON));

        self::assertFalse($settings->inForce($this->organisation, PlanFeature::EmailDomains), 'switched off');
        self::assertSame('ire.events', $domains->value, 'and kept as it was');
        $mails = $this->mails();
        self::assertCount(1, $mails);
        self::assertStringContainsString('These were switched off on', $mails[0]);
        self::assertStringContainsString(' WAT and kept as they were:', $mails[0], "the day in the owner's own zone");
        self::assertStringContainsString('- Email domains', $mails[0]);
        self::assertStringNotContainsString('Audit log', $mails[0], 'only what was configured');
        self::assertStringContainsString('They come back on as they were with Enterprise. Contact Soirely about Enterprise.', $mails[0]);
    }

    #[Test]
    public function anUpgradeSwitchesThemBackOnAsTheyWere(): void
    {
        $settings = $this->settings([new ConfiguredEnterpriseSetting(PlanFeature::EmailDomains, 'ire.events')]);
        $changer = $this->changer($settings);
        $changer->change($this->organisation, Plan::Enterprise, 'Ada at Soirely', self::REASON);
        $changer->change($this->organisation, Plan::Free, 'Ada at Soirely', self::REASON);

        $changer->change($this->organisation, Plan::Enterprise, 'Ada at Soirely', self::REASON);

        self::assertTrue($settings->inForce($this->organisation, PlanFeature::EmailDomains));
    }

    #[Test]
    public function aDowngradeWithNothingConfiguredEmailsNobody(): void
    {
        $changer = $this->changer($this->settings([new ConfiguredEnterpriseSetting(PlanFeature::EmailDomains)]));
        $changer->change($this->organisation, Plan::Enterprise, 'Ada at Soirely', self::REASON);

        self::assertSame([], $changer->change($this->organisation, Plan::Free, 'Ada at Soirely', self::REASON));
        self::assertSame([], $this->mails());
    }

    #[Test]
    public function thePlanToItselfIsNoChangeAndNotAudited(): void
    {
        self::assertSame([], $this->changer($this->settings([]))->change($this->organisation, Plan::Free, 'Ada at Soirely', self::REASON));
        self::assertNull(self::service(EntityManagerInterface::class)->getRepository(AuditEntry::class)->findOneBy(['action' => PlanChanger::CHANGED, 'subjectId' => $this->organisation->getId()]));
    }

    #[Test]
    public function nobodyNamedIsRefused(): void
    {
        $this->expectException(RuntimeException::class);

        $this->changer($this->settings([]))->change($this->organisation, Plan::Enterprise, '  ', self::REASON);
    }

    /** Through the real directory: the organisation's plan reaches the grants the access check reads, on both of its paths. */
    #[Test]
    public function theOwnerChangesAnEnterpriseSettingOnlyWhileTheOrganisationIsOnEnterprise(): void
    {
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($this->owner));
        $organisationId = $this->organisation->getId()->toRfc4122();

        $this->moveTo(Plan::Enterprise);

        foreach (['enterprise', 'enterprise-on-an-event'] as $route) {
            $this->client->request('PUT', '/api/_access/organisations/' . $organisationId . '/' . $route);
            self::assertResponseIsSuccessful($route);
        }

        $this->moveTo(Plan::Free);

        foreach (['enterprise', 'enterprise-on-an-event'] as $route) {
            $this->client->request('PUT', '/api/_access/organisations/' . $organisationId . '/' . $route);
            $body = Json\typed((string) $this->client->getResponse()->getContent(), Type\shape(['type' => Type\string(), 'feature' => Type\string()], true));

            self::assertResponseStatusCodeSame(403, $route);
            self::assertSame(ErrorCode::PlanRequired->type(), $body['type'], $route);
            self::assertSame(PlanFeature::EmailDomains->value, $body['feature'], $route);
        }
    }

    /** Regression: everything not on the list is open on both plans, and everything on it only on Enterprise. */
    #[Test]
    public function onlyEnterpriseUnlocksTheListAndFreeUnlocksNoneOfIt(): void
    {
        foreach (PlanFeature::cases() as $feature) {
            self::assertTrue(Plan::Enterprise->unlocks($feature), $feature->value);
            self::assertFalse(Plan::Free->unlocks($feature), $feature->value);
        }
    }

    /** The production changer, on the organisation as the container now holds it: a request reboots the kernel and clears what was loaded before it. */
    private function moveTo(Plan $plan): void
    {
        $organisation = self::service(EntityManagerInterface::class)->find(Organisation::class, $this->organisation->getId()) ?? self::fail('gone');
        self::service(PlanChanger::class)->change($organisation, $plan, 'Ada at Soirely', self::REASON);
    }

    private function changer(EnterpriseSettings $settings): PlanChanger
    {
        return new PlanChanger(
            self::service(Auditor::class),
            self::service(PlanDowngradeMailer::class),
            self::service(ClockInterface::class),
            $settings,
            self::service(SubscriptionRepository::class),
            self::service(SubscriptionChanger::class),
        );
    }

    /** @param list<ConfiguredEnterpriseSetting> $settings */
    private function settings(array $settings): EnterpriseSettings
    {
        return new EnterpriseSettings($settings, self::service(Entitlements::class));
    }

    private function plan(): Plan
    {
        return self::service(SubscriptionRepository::class)->findCurrentOf($this->organisation->getId())->getPlan();
    }

    /** @return list<string> the bodies sent to the owner */
    private function mails(): array
    {
        $mails = Vec\filter(
            Type\vec(Type\instance_of(Email::class))->coerce(self::getMailerMessages()),
            static fn (Email $mail): bool => self::SUBJECT === $mail->getSubject() && Iter\any($mail->getTo(), static fn ($to): bool => 'folake@ire.events' === $to->getAddress()),
        );

        return Vec\map($mails, static fn (Email $mail): string => Type\string()->coerce($mail->getTextBody()));
    }
}
