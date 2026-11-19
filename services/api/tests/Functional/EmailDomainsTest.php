<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\DomainJoining\JoinOfferFinder;
use App\Domain\Organisation\EmailDomains\EmailDomains;
use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Organisation\OwnerClaims\ScriptedTxtRecordLookup;
use App\Domain\Organisation\Plan\PlanChanger;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\EmailDomain;
use App\Entity\Organisation;
use App\Entity\OrganisationDomain;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\Plan;
use App\Enum\PlanFeature;
use App\Enum\SeededRole;
use App\Repository\EmailDomainRepository;
use App\Repository\MembershipRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

final class EmailDomainsTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string RECORD = '_soirely-verify.ire.events';

    protected function setUp(): void
    {
        parent::setUp();
        ScriptedTxtRecordLookup::forgetAll();
    }

    #[Test]
    public function addingShowsARecordUniqueToTheOrganisationAndDomainAndVerifyProvesIt(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        [, $other] = $this->enterprise('ada@lumen.pt', 'Lumen');
        $this->signIn($owner);

        $body = $this->send('POST', $this->path($organisation), ['domain' => ' IRE.events ']);

        self::assertResponseStatusCodeSame(201);
        $row = $this->row($body, 'ire.events');
        self::assertSame('waiting', $row['status']);
        self::assertSame(['type' => 'TXT', 'name' => self::RECORD], ['type' => $row['record']['type'], 'name' => $row['record']['name']]);
        self::assertMatchesRegularExpression('/^[a-z0-9]{32}$/', $row['record']['value']);
        self::assertSame(['domain' => [null, 'ire.events']], $this->audited(EmailDomains::ADDED, $organisation)->getChanges());
        self::assertNotSame($row['record']['value'], $this->add($other, 'ire.events')->getRecordValue(), 'each organisation has its own value');

        ScriptedTxtRecordLookup::publish(self::RECORD, $row['record']['value']);
        $this->signIn($owner);
        $verified = $this->send('POST', $this->path($organisation, 'ire.events/verify'));

        self::assertResponseStatusCodeSame(200);
        self::assertTrue($verified['found']);
        $proved = $this->row($verified, 'ire.events');
        self::assertSame('proved', $proved['status']);
        self::assertNotNull($proved['provedAt']);
        self::assertSame(['domain' => ['ire.events', 'ire.events'], 'status' => ['waiting', 'proved']], $this->audited(EmailDomains::PROVED, $organisation)->getChanges());
    }

    #[Test]
    public function aRecordNotFoundYetKeepsTheDomainWaiting(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $this->add($organisation, 'ire.events');
        ScriptedTxtRecordLookup::publish(self::RECORD, 'soirely-claim=somethingelse');
        $this->signIn($owner);

        $body = $this->send('POST', $this->path($organisation, 'ire.events/verify'));

        self::assertResponseStatusCodeSame(200);
        self::assertFalse($body['found']);
        self::assertSame('waiting', $this->row($body, 'ire.events')['status']);
    }

    #[Test]
    public function aDomainAnotherOrganisationHasProvedIsRefusedOnAddingAndOnVerifying(): void
    {
        [, $prover] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        [$owner, $organisation] = $this->enterprise('ada@lumen.pt', 'Lumen');
        $late = $this->add($organisation, 'ire.events');
        $this->prove($this->add($prover, 'ire.events'));
        $this->signIn($owner);

        $body = $this->send('POST', $this->path($organisation), ['domain' => 'ire.events']);
        self::assertResponseStatusCodeSame(422);
        self::assertSame([['domain', 'Another organisation has already proved this domain. Contact Soirely support if it is yours.', 'domain_taken']], $this->violations($body));

        ScriptedTxtRecordLookup::publish(self::RECORD, $late->getRecordValue());
        $refused = $this->send('POST', $this->path($organisation, 'ire.events/verify'));
        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::EmailDomainTaken->type(), $refused['type']);
    }

    #[Test]
    public function aPublicMailDomainABlankOneAndOneWithoutADotAreRefused(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $this->signIn($owner);

        $public = $this->send('POST', $this->path($organisation), ['domain' => 'gmail.com']);
        self::assertResponseStatusCodeSame(422);
        self::assertSame([['domain', 'You cannot use a public email domain.', 'domain_public']], $this->violations($public));

        $blank = $this->send('POST', $this->path($organisation), ['domain' => '  ']);
        self::assertSame('domain_blank', $this->violations($blank)[0][2]);

        $invalid = $this->send('POST', $this->path($organisation), ['domain' => 'ire events']);
        self::assertSame('domain_invalid', $this->violations($invalid)[0][2]);
        self::assertSame([], $this->send('GET', $this->path($organisation))['domains']);
    }

    #[Test]
    public function provingStopsOtherOrganisationsListingsForJoiningAndEmailsTheirAdminsOnce(): void
    {
        [, $prover] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        [$lister, $listing] = $this->enterprise('marta@casalumen.pt', 'Casa Lumen Eventos');
        $admin = $this->member('rui@casalumen.pt', 'Rui');
        $this->join($listing, $admin, SeededRole::Admin);
        $this->list($listing, 'ire.events');
        $joined = $this->member('tunde@ire.events', 'Tunde');
        $this->join($listing, $joined, SeededRole::Member, MembershipChannel::Domain);
        $colleague = $this->member('kemi@ire.events', 'Kemi');
        self::assertCount(1, self::service(JoinOfferFinder::class)->offersFor($colleague));

        $this->prove($this->add($prover, 'ire.events'));

        $mails = $this->mailsTitled('ire.events is no longer listed for joining Casa Lumen Eventos');
        self::assertSame(['marta@casalumen.pt', 'rui@casalumen.pt'], Vec\sort(Vec\map($mails, self::to(...))));
        self::assertStringContainsString('Ìrè Events has proved that it owns ire.events', (string) $mails[0]->getTextBody());
        self::assertSame([], self::service(JoinOfferFinder::class)->offersFor($colleague));
        $this->signIn($lister);
        self::assertSame([['domain' => 'ire.events', 'stopped' => true, 'proved' => false]], $this->send('GET', $this->joiningPath($listing))['domains']);
        $membership = self::service(MembershipRepository::class)->findActive($joined, $listing->getId()) ?? self::fail('the domain member was paused');
        self::assertSame(MembershipStatus::Active, $membership->getStatus());
        self::assertNull($membership->getSuspension());
        $this->signIn($joined);
        self::assertSame([], $this->send('GET', '/api/orgs')['paused']);

        $this->prove($this->fresh($this->emailDomain($prover, 'ire.events')));
        self::service(EmailDomains::class)->checkDue();
        self::assertSame(2, $this->queued('mail.domain_listing_stopped'), 'told once, when it was proved');
    }

    #[Test]
    public function aWaitingDomainIsLookedUpHourlyAndFailsAtItsOneInstantSevenDaysAfterItWasAdded(): void
    {
        [, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $domain = $this->add($organisation, 'ire.events');
        $this->move($domain, 'checked_at', '-61 minutes');
        ScriptedTxtRecordLookup::publish(self::RECORD, $domain->getRecordValue());

        self::service(EmailDomains::class)->checkDue();
        self::assertTrue($this->fresh($domain)->isProved());

        $late = $this->add($organisation, 'lumen.events');
        $this->move($late, 'added_at', '-7 days -1 minute');
        $addedAt = $this->fresh($late)->getAddedAt();

        self::service(EmailDomains::class)->checkDue();

        $failed = $this->fresh($late);
        self::assertSame('failed', EmailDomains::statusOf($failed, new DateTimeImmutable()));
        self::assertEquals($addedAt->modify('+168 hours'), $failed->getFailedAt());
        self::assertEquals($addedAt->modify('+168 hours'), $this->audited(EmailDomains::FAILED, $organisation)->getOccurredAt());
    }

    #[Test]
    public function aRecordGoneAtTheThirtyDayRecheckEmailsTheAdminsAndLapsesFourteenDaysAfterItWasFirstMissed(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $domain = $this->add($organisation, 'ire.events');
        $this->prove($domain);
        $this->move($domain, 'found_at', '-30 days -1 minute');
        ScriptedTxtRecordLookup::unpublish(self::RECORD);

        self::service(EmailDomains::class)->checkDue();

        $missing = $this->fresh($domain);
        self::assertSame('missing', EmailDomains::statusOf($missing, new DateTimeImmutable()));
        self::assertTrue($missing->isProved(), 'still proved for its 14 days');
        $mails = $this->mailsTitled('The record for ire.events is missing');
        self::assertSame(['folake@ire.events'], Vec\map($mails, self::to(...)));
        self::assertStringContainsString('Put it back by ', (string) $mails[0]->getTextBody());
        self::assertStringContainsString("Type: TXT\n\nName: _soirely-verify.ire.events\n\nValue: {$missing->getRecordValue()}", (string) $mails[0]->getTextBody());

        $this->move($domain, 'missing_since', '-14 days -1 minute');
        $putBackBy = $this->fresh($domain)->putBackBy();
        self::service(EmailDomains::class)->checkDue();

        $lapsed = $this->fresh($domain);
        self::assertFalse($lapsed->isProved());
        self::assertSame('failed', EmailDomains::statusOf($lapsed, new DateTimeImmutable()));
        self::assertEquals($putBackBy, $this->audited(EmailDomains::LAPSED, $organisation)->getOccurredAt());
        $this->signIn($owner);
        $row = $this->row($this->send('GET', $this->path($organisation)), 'ire.events');
        self::assertSame('failed', $row['status']);
        self::assertSame($putBackBy?->format(\DATE_ATOM), $row['failedAt']);
        self::assertNotNull($row['failed']);
    }

    #[Test]
    public function aRecordPutBackBeforeItsInstantKeepsTheDomainProved(): void
    {
        [, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $domain = $this->add($organisation, 'ire.events');
        $this->prove($domain);
        $this->move($domain, 'found_at', '-31 days');
        ScriptedTxtRecordLookup::unpublish(self::RECORD);
        self::service(EmailDomains::class)->checkDue();

        ScriptedTxtRecordLookup::publish(self::RECORD, $domain->getRecordValue());
        $this->move($domain, 'checked_at', '-61 minutes');
        self::service(EmailDomains::class)->checkDue();

        self::assertSame('proved', EmailDomains::statusOf($this->fresh($domain), new DateTimeImmutable()));
    }

    #[Test]
    public function thePutBackInstantIsOneInstantWrittenInEachAdminsOwnZone(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $julien = $this->member('julien@ire.events', 'Julien');
        $this->join($organisation, $julien, SeededRole::Admin);
        $owner->setTimezone('Africa/Lagos');
        $julien->setTimezone('Europe/London');
        $domain = $this->add($organisation, 'ire.events');
        $this->prove($domain);
        $this->move($domain, 'found_at', '-31 days');
        ScriptedTxtRecordLookup::unpublish(self::RECORD);
        self::service(EmailDomains::class)->checkDue();

        $this->signIn($owner);
        $lagos = $this->row($this->send('GET', $this->path($organisation)), 'ire.events');
        $this->signIn($julien);
        $london = $this->row($this->send('GET', $this->path($organisation)), 'ire.events');

        self::assertSame($lagos['putBackByAt'], $london['putBackByAt']);
        self::assertStringEndsWith(' WAT', (string) $lagos['putBackBy']);
        self::assertMatchesRegularExpression('/ (GMT|BST)$/', (string) $london['putBackBy']);
        $bodies = Vec\map($this->mailsTitled('is missing'), static fn (Email $mail): string => self::to($mail) . ' ' . (string) $mail->getTextBody());
        self::assertCount(2, $bodies);
        self::assertTrue(Iter\any($bodies, static fn (string $body): bool => Str\starts_with($body, 'folake@') && Str\contains($body, (string) $lagos['putBackBy'])));
        self::assertTrue(Iter\any($bodies, static fn (string $body): bool => Str\starts_with($body, 'julien@') && Str\contains($body, (string) $london['putBackBy'])));
    }

    #[Test]
    public function removingAProvedDomainEndsItsProofAndIsAudited(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $this->prove($this->add($organisation, 'ire.events'));
        $this->signIn($owner);

        $body = $this->send('DELETE', $this->path($organisation, 'ire.events'));

        self::assertResponseStatusCodeSame(200);
        self::assertSame([], $body['domains']);
        self::assertSame(['domain' => ['ire.events', null], 'status' => ['proved', null]], $this->audited(EmailDomains::REMOVED, $organisation)->getChanges());
        self::assertNull(self::service(EmailDomainRepository::class)->findProvedOf('ire.events'));
    }

    #[Test]
    public function aFreeOrganisationReadsTheLockAndAChangeIsRefused(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->signIn($owner);

        self::assertSame(['plan' => 'free', 'ownerChanges' => true, 'domains' => []], $this->send('GET', $this->path($organisation)));

        $body = $this->send('POST', $this->path($organisation), ['domain' => 'ire.events']);
        self::assertResponseStatusCodeSame(403);
        self::assertSame(ErrorCode::PlanRequired->type(), $body['type']);
        self::assertSame(PlanFeature::EmailDomains->value, $body['feature']);
    }

    #[Test]
    public function anOrganisationThatLeftEnterpriseKeepsItsDomainsReadOnlyAndTheirProofOutOfForce(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        [, $listing] = $this->enterprise('marta@casalumen.pt', 'Casa Lumen Eventos');
        $this->list($listing, 'ire.events');
        $this->prove($this->add($organisation, 'ire.events'));
        $colleague = $this->member('kemi@ire.events', 'Kemi');
        self::assertSame([], self::service(JoinOfferFinder::class)->offersFor($colleague));

        $this->moveTo($organisation, Plan::Free);
        $this->signIn($owner);
        $body = $this->send('GET', $this->path($organisation));

        self::assertSame('left', $body['plan']);
        self::assertSame('proved', $this->row($body, 'ire.events')['status']);
        self::assertCount(1, self::service(JoinOfferFinder::class)->offersFor($colleague));
        $this->send('DELETE', $this->path($organisation, 'ire.events'));
        self::assertResponseStatusCodeSame(403);
    }

    #[Test]
    public function aProofHeldByAnOrganisationThatLeftEnterpriseIsStillTakenAndTheHourlyCheckCarriesOn(): void
    {
        [, $prover] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        [$owner, $organisation] = $this->enterprise('ada@lumen.pt', 'Lumen');
        $late = $this->add($organisation, 'ire.events');
        $other = $this->add($organisation, 'lumen.pt');
        $this->prove($this->add($prover, 'ire.events'));
        $this->moveTo($prover, Plan::Free);

        $this->signIn($owner);
        $body = $this->send('POST', $this->path($organisation), ['domain' => 'ire.events']);
        self::assertResponseStatusCodeSame(422);
        self::assertSame('domain_taken', $this->violations($body)[0][2]);

        ScriptedTxtRecordLookup::publish(self::RECORD, $late->getRecordValue());
        ScriptedTxtRecordLookup::publish(EmailDomains::recordName('lumen.pt'), $other->getRecordValue());
        $this->move($late, 'checked_at', '-2 hours');
        $this->move($other, 'checked_at', '-61 minutes');
        self::service(EmailDomains::class)->checkDue();

        self::assertFalse($this->fresh($late)->isProved());
        self::assertTrue($this->fresh($other)->isProved());
        $this->send('POST', $this->path($organisation, 'ire.events/verify'));
        self::assertResponseStatusCodeSame(409);
    }

    #[Test]
    public function aMemberIsRefusedReadingAddingVerifyingAndRemoving(): void
    {
        [, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $this->add($organisation, 'ire.events');
        $member = $this->member('kemi@ire.events', 'Kemi');
        $this->join($organisation, $member, SeededRole::Member);
        $this->signIn($member);

        foreach ([['GET', ''], ['POST', ''], ['POST', 'ire.events/verify'], ['DELETE', 'ire.events']] as [$method, $tail]) {
            $body = $this->send($method, $this->path($organisation, $tail), 'POST' === $method && '' === $tail ? ['domain' => 'lumen.events'] : null);
            self::assertResponseStatusCodeSame(403);
            self::assertSame(ErrorCode::PermissionRequired->type(), $body['type'], $method . ' ' . $tail);
        }
    }

    #[Test]
    public function aProvedDomainIsNotListedForJoiningNorCountedTowardItsFive(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $this->prove($this->add($organisation, 'ire.events'));
        $colleague = $this->member('kemi@ire.events', 'Kemi');

        self::assertSame([], self::service(JoinOfferFinder::class)->offersFor($colleague));
        $this->signIn($owner);
        $joining = $this->send('GET', $this->joiningPath($organisation));
        self::assertSame([], $joining['domains']);
        self::assertSame(5, $joining['most']);

        $this->signIn($owner);
        $this->send('POST', $this->joiningPath($organisation), ['domain' => 'ire.events']);
        self::assertResponseStatusCodeSame(201);
    }

    #[Test]
    public function aDomainOnBothListsSaysProvedOnItsJoiningRowAndRemovingItFromOneLeavesTheOther(): void
    {
        [$owner, $organisation] = $this->enterprise('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $this->prove($this->add($organisation, 'ire.events'));
        $this->signIn($owner);
        self::assertSame([['domain' => 'ire.events', 'stopped' => false, 'proved' => true]], $this->send('GET', $this->joiningPath($organisation))['domains']);

        $this->signIn($owner);
        $this->send('DELETE', $this->path($organisation, 'ire.events'));
        $this->signIn($owner);
        self::assertSame([['domain' => 'ire.events', 'stopped' => false, 'proved' => false]], $this->send('GET', $this->joiningPath($organisation))['domains']);

        $this->prove($this->add($organisation, 'ire.events'));
        $this->signIn($owner);
        $this->send('DELETE', $this->joiningPath($organisation) . '/ire.events');
        self::assertResponseStatusCodeSame(200);
        $this->signIn($owner);
        self::assertSame('proved', $this->row($this->send('GET', $this->path($organisation)), 'ire.events')['status']);
    }

    /** @return array{User, Organisation} */
    private function enterprise(string $address, string $name): array
    {
        [$owner, $organisation] = $this->organisation($address, $name);
        $this->moveTo($organisation, Plan::Enterprise);

        return [$owner, $organisation];
    }

    /** @return array{User, Organisation} */
    private function organisation(string $address, string $name): array
    {
        $owner = $this->member($address, 'Owner of ' . $name);
        $organisation = self::service(OrganisationFounder::class)->found($owner, $name, 'NG', 'Africa/Lagos');
        self::service(EntityManagerInterface::class)->flush();

        return [$owner, $organisation];
    }

    private function moveTo(Organisation $organisation, Plan $plan): void
    {
        $organisation = self::service(EntityManagerInterface::class)->find(Organisation::class, $organisation->getId()) ?? self::fail('gone');
        self::service(PlanChanger::class)->change($organisation, $plan, 'Ada at Soirely', 'A test needs it.');
        self::service(EntityManagerInterface::class)->flush();
    }

    private function add(Organisation $organisation, string $domain): EmailDomain
    {
        $entityManager = self::service(EntityManagerInterface::class);
        $added = new EmailDomain($entityManager->find(Organisation::class, $organisation->getId()) ?? self::fail('gone'), $domain, SecureRandom\string(32), new DateTimeImmutable());
        $entityManager->persist($added);
        $entityManager->flush();

        return $added;
    }

    private function prove(EmailDomain $domain): void
    {
        ScriptedTxtRecordLookup::publish(EmailDomains::recordName($domain->getDomain()), $domain->getRecordValue());
        $this->signIn($this->ownerOf($domain->getOrganisation()));
        $this->send('POST', $this->path($domain->getOrganisation(), $domain->getDomain() . '/verify'));
        self::assertResponseStatusCodeSame(200);
    }

    private function ownerOf(Organisation $organisation): User
    {
        $owner = Iter\first(self::service(MembershipRepository::class)->findOwnersIn($organisation)) ?? self::fail('no owner');

        return $owner->getUser();
    }

    private function list(Organisation $organisation, string $domain): void
    {
        $entityManager = self::service(EntityManagerInterface::class);
        $entityManager->persist(new OrganisationDomain($entityManager->find(Organisation::class, $organisation->getId()) ?? self::fail('gone'), $domain));
        $entityManager->flush();
    }

    private function emailDomain(Organisation $organisation, string $domain): EmailDomain
    {
        return self::service(EmailDomainRepository::class)->findOneInOrganisation($organisation, $domain) ?? self::fail('not on the list');
    }

    private function queued(string $type): int
    {
        return Type\int()->coerce(self::service(EntityManagerInterface::class)->getConnection()->fetchOne('SELECT COUNT(*) FROM scheduled_notifications WHERE type = ?', [$type]));
    }

    private function move(EmailDomain $domain, string $column, string $by): void
    {
        $at = new DateTimeImmutable()->modify($by);
        self::service(EntityManagerInterface::class)->getConnection()->executeStatement(
            Str\format('UPDATE organisation_email_domains SET %s = ? WHERE id = ?', $column),
            [$at->format('Y-m-d H:i:s'), $domain->getId()->toRfc4122()],
        );
    }

    private function fresh(EmailDomain $domain): EmailDomain
    {
        $entityManager = self::service(EntityManagerInterface::class);
        $entityManager->clear();

        return self::service(EmailDomainRepository::class)->find($domain->getId()) ?? self::fail('no such domain');
    }

    private function member(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function join(Organisation $organisation, User $user, SeededRole $as, MembershipChannel $channel = MembershipChannel::Invitation): void
    {
        $role = Type\instance_of(Role::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $as]),
        );
        self::service(MembershipMachine::class)->join($organisation, $user, $role, MembershipStatus::Active, $channel, $user);
        self::service(EntityManagerInterface::class)->flush();
    }

    private function audited(string $action, Organisation $organisation): AuditEntry
    {
        return Type\instance_of(AuditEntry::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(AuditEntry::class)->findOneBy(['action' => $action, 'subjectId' => $organisation->getId()]),
        );
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array{status: string, record: array{type: string, name: string, value: string}, provedAt: ?string, putBackByAt: ?string, putBackBy: ?string, ...}
     */
    private function row(array $body, string $domain): array
    {
        $rows = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($body['domains']);

        foreach ($rows as $row) {
            if ($domain === $row['domain']) {
                return Type\shape([
                    'status' => Type\string(),
                    'record' => Type\shape(['type' => Type\string(), 'name' => Type\string(), 'value' => Type\string()]),
                    'provedAt' => Type\nullable(Type\string()),
                    'putBackByAt' => Type\nullable(Type\string()),
                    'putBackBy' => Type\nullable(Type\string()),
                ], true)->coerce($row);
            }
        }

        self::fail('no row for ' . $domain);
    }

    /** @return list<array{string, string, string}> */
    private function violations(mixed $body): array
    {
        return Vec\map(
            Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string(), 'code' => Type\string()], true))->coerce(Type\shape(['violations' => Type\mixed()], true)->coerce($body)['violations']),
            static fn (array $violation): array => [$violation['propertyPath'], $violation['message'], $violation['code']],
        );
    }

    /** @return list<Email> */
    private function mailsTitled(string $part): array
    {
        return Vec\map(Vec\filter(
            self::getMailerMessages(),
            static fn (object $message): bool => $message instanceof Email && Str\contains((string) $message->getSubject(), $part),
        ), static fn (object $message): Email => Type\instance_of(Email::class)->coerce($message));
    }

    private static function to(Email $mail): string
    {
        return Type\instance_of(Address::class)->coerce($mail->getTo()[0] ?? null)->getAddress();
    }

    private function path(Organisation $organisation, string $tail = ''): string
    {
        return Str\format('/api/orgs/%s/email-domains', $organisation->getId()->toRfc4122()) . ('' === $tail ? '' : '/' . $tail);
    }

    private function joiningPath(Organisation $organisation): string
    {
        return Str\format('/api/orgs/%s/domains', $organisation->getId()->toRfc4122());
    }

    private function signIn(User $user): void
    {
        self::service(EntityManagerInterface::class)->flush();
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user));
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function send(string $method, string $uri, ?array $body = null): array
    {
        $this->client->request($method, $uri, server: ['CONTENT_TYPE' => 'application/json'], content: null === $body ? null : Json\encode($body));
        $content = (string) $this->client->getResponse()->getContent();

        return '' === $content ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($content));
    }
}
