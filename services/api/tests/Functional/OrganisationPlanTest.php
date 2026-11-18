<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Audit\Auditor;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Organisation\Plan\PlanChanger;
use App\Domain\Organisation\Plan\PlanDowngradeMailer;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use App\Enum\Plan;
use App\Enum\PlanFeature;
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
        self::assertSame(Plan::Free, $this->organisation->getPlan());

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
        ]));

        $entityManager = self::service(EntityManagerInterface::class);
        $entityManager->clear();
        $organisation = $entityManager->find(Organisation::class, $this->organisation->getId()) ?? self::fail('gone');
        self::assertSame(Plan::Enterprise, $organisation->getPlan());

        $entry = $entityManager->getRepository(AuditEntry::class)->findOneBy(['action' => PlanChanger::CHANGED, 'subjectId' => $organisation->getId()]) ?? self::fail('no audit entry');
        self::assertSame(Actor::Agent, $entry->getActorType());
        self::assertSame('Ada at Soirely', $entry->getActorLabel());
        self::assertSame(['plan' => ['free', 'enterprise']], $entry->getChanges());
    }

    #[Test]
    public function aChangeWithNobodyNamedIsRefusedAndChangesNothing(): void
    {
        $tester = new CommandTester(new Application(self::$kernel ?? self::fail('no kernel'))->find('app:set-plan'));

        self::assertSame(Command::FAILURE, $tester->execute([
            'organisation' => $this->organisation->getId()->toRfc4122(),
            'plan' => 'enterprise',
        ]));
        self::assertSame(Plan::Free, $this->organisation->getPlan());
    }

    #[Test]
    public function aDowngradeSwitchesConfiguredSettingsOffKeepsThemAndEmailsTheAdministrators(): void
    {
        $domains = new ConfiguredEnterpriseSetting(PlanFeature::EmailDomains, 'ire.events');
        $auditLog = new ConfiguredEnterpriseSetting(PlanFeature::AuditLog);
        $changer = $this->changer([$domains, $auditLog]);
        $changer->change($this->organisation, Plan::Enterprise, 'Ada at Soirely');
        self::assertSame('ire.events', $domains->inForce($this->organisation));
        self::assertSame([], $this->mails(), 'an upgrade emails nobody');

        self::assertSame([PlanFeature::EmailDomains], $changer->change($this->organisation, Plan::Free, 'Ada at Soirely'));

        self::assertNull($domains->inForce($this->organisation), 'switched off');
        self::assertSame('ire.events', $domains->value, 'and kept as it was');
        $mails = $this->mails();
        self::assertCount(1, $mails);
        self::assertStringContainsString('These were switched off on', $mails[0]);
        self::assertStringContainsString('- Email domains', $mails[0]);
        self::assertStringNotContainsString('Audit log', $mails[0], 'only what was configured');
        self::assertStringContainsString('They come back on as they were with Enterprise. Contact Soirely about Enterprise.', $mails[0]);
    }

    #[Test]
    public function anUpgradeSwitchesThemBackOnAsTheyWere(): void
    {
        $domains = new ConfiguredEnterpriseSetting(PlanFeature::EmailDomains, 'ire.events');
        $changer = $this->changer([$domains]);
        $changer->change($this->organisation, Plan::Enterprise, 'Ada at Soirely');
        $changer->change($this->organisation, Plan::Free, 'Ada at Soirely');

        $changer->change($this->organisation, Plan::Enterprise, 'Ada at Soirely');

        self::assertSame('ire.events', $domains->inForce($this->organisation));
    }

    #[Test]
    public function aDowngradeWithNothingConfiguredEmailsNobody(): void
    {
        $changer = $this->changer([new ConfiguredEnterpriseSetting(PlanFeature::EmailDomains)]);
        $changer->change($this->organisation, Plan::Enterprise, 'Ada at Soirely');

        self::assertSame([], $changer->change($this->organisation, Plan::Free, 'Ada at Soirely'));
        self::assertSame([], $this->mails());
    }

    #[Test]
    public function thePlanToItselfIsNoChangeAndNotAudited(): void
    {
        self::assertSame([], $this->changer([])->change($this->organisation, Plan::Free, 'Ada at Soirely'));
        self::assertNull(self::service(EntityManagerInterface::class)->getRepository(AuditEntry::class)->findOneBy(['action' => PlanChanger::CHANGED, 'subjectId' => $this->organisation->getId()]));
    }

    #[Test]
    public function nobodyNamedIsRefused(): void
    {
        $this->expectException(RuntimeException::class);

        $this->changer([])->change($this->organisation, Plan::Enterprise, '  ');
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

    /** @param list<ConfiguredEnterpriseSetting> $settings */
    private function changer(array $settings): PlanChanger
    {
        return new PlanChanger(
            self::service(Auditor::class),
            self::service(PlanDowngradeMailer::class),
            self::service(EntityManagerInterface::class),
            self::service(ClockInterface::class),
            $settings,
        );
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
