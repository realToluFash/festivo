<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\DomainJoining\JoinRequester;
use App\Domain\Organisation\EmailDomains\EmailDomains;
use App\Domain\Organisation\EmailDomains\ManagedAccounts;
use App\Domain\Organisation\EmailDomains\OnlyOurOrganisation;
use App\Domain\Organisation\Invitations\InvitationSender;
use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Organisation\OwnerClaims\ScriptedTxtRecordLookup;
use App\Domain\Organisation\Plan\PlanChanger;
use App\Domain\Organisation\RequestLink\RequestLinkEditor;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\EmailAddress;
use App\Entity\EmailDomain;
use App\Entity\Invitation;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\OrganisationDomain;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\InvitationStatus;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\Plan;
use App\Enum\SeededRole;
use App\Http\Exception\ApiException;
use App\Repository\EmailDomainRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\InvitesPeople;
use App\Tests\Traits\OnboardsAccounts;
use DateInterval;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Iter;
use Psl\Json;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

final class ManagedAccountsTest extends ApiTestCase
{
    use InvitesPeople;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string MANAGED = 'Your ire.events address is managed by Ìrè Events, so you can only be a member there.';

    protected function setUp(): void
    {
        parent::setUp();
        ScriptedTxtRecordLookup::forgetAll();
    }

    #[Test]
    public function switchingOnIsRefusedOnAFreeOrganisation(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->signIn($owner);

        $body = $this->send('POST', $this->path($organisation, 'ire.events/only-ours'));

        self::assertResponseStatusCodeSame(403);
        self::assertSame(ErrorCode::PlanRequired->type(), $body['type']);
    }

    #[Test]
    public function onlyTheOwnerSwitchesItAnAdminIsRefusedWith403AndSeesItsState(): void
    {
        [, $organisation] = $this->proved();
        $admin = $this->member('tunde@ire.events', 'Tunde');
        $this->join($organisation, $admin, SeededRole::Admin);
        $this->signIn($admin);

        $refused = $this->send('POST', $this->path($organisation, 'ire.events/only-ours'));
        self::assertResponseStatusCodeSame(403);
        self::assertSame(ErrorCode::OwnerRequired->type(), $refused['type']);
        self::assertSame('Only an owner can change this.', $refused['detail']);

        $this->send('DELETE', $this->path($organisation, 'ire.events/only-ours'));
        self::assertResponseStatusCodeSame(403);

        $page = $this->send('GET', $this->path($organisation));
        self::assertFalse($page['ownerChanges']);
        self::assertSame('off', $this->row($page)['onlyOurs']);
    }

    #[Test]
    public function aMemberIsRefusedWith403(): void
    {
        [, $organisation] = $this->proved();
        $member = $this->member('kemi@ire.events', 'Kemi');
        $this->join($organisation, $member, SeededRole::Member);
        $this->signIn($member);

        $this->send('POST', $this->path($organisation, 'ire.events/only-ours'));

        self::assertResponseStatusCodeSame(403);
    }

    #[Test]
    public function switchingOnSchedulesItFourteenDaysOnAndEmailsEveryAccountAtTheDomainAtOnce(): void
    {
        [$owner, $organisation] = $this->proved();
        $kemi = $this->member('kemi@ire.events', 'Kemi');
        $this->unverified('bayo@ire.events');
        $this->member('ada@lumen.pt', 'Ada');
        $this->signIn($owner);
        $before = new DateTimeImmutable();

        $page = $this->send('POST', $this->path($organisation, 'ire.events/only-ours'));

        self::assertResponseStatusCodeSame(200);
        $row = $this->row($page);
        self::assertSame('scheduled', $row['onlyOurs']);
        $from = new DateTimeImmutable(Type\string()->coerce($row['onlyOursFromAt']));
        $switchedOn = $this->fresh()->getOnlyOursSwitchedOnAt() ?? self::fail('not switched on');
        self::assertEquals($switchedOn->add(new DateInterval('P14D')), $from, 'the instant plus 14 × 24 hours');
        self::assertGreaterThanOrEqual($before->getTimestamp(), $switchedOn->getTimestamp() + 1);
        self::assertTrue($page['ownerChanges']);

        $notices = $this->mailsTitled('manages Soirely accounts at ire.events');
        self::assertSame(['folake@ire.events', 'kemi@ire.events'], Vec\sort(Vec\map($notices, self::to(...))), 'every verified main address at the domain, nobody else');
        $body = (string) Iter\first($notices)?->getTextBody();
        self::assertStringContainsString('From ' . Type\string()->coerce($row['onlyOursFrom']) . ', your account can only be a member of Ìrè Events.', $body);
        self::assertStringContainsString("If this account is your own and not the company's, change your main email address before then.", $body);
        self::assertSame(['domain' => ['ire.events', 'ire.events'], 'onlyOurs' => ['off', 'scheduled'], 'from' => [null, $from->format(\DATE_ATOM)]], $this->audited(OnlyOurOrganisation::SWITCHED_ON, $organisation)->getChanges());
        self::assertSame(2, $this->audited(OnlyOurOrganisation::NOTICE_SENT, $organisation)->getChanges()['recipients'][1]);

        $this->createOrganisation($kemi);
        self::assertResponseStatusCodeSame(201, 'nothing is refused while it waits');
    }

    #[Test]
    public function cancellingBeforeTheDateLeavesEveryoneFree(): void
    {
        [$owner, $organisation] = $this->proved();
        $this->switchOn($owner, $organisation);

        $page = $this->send('DELETE', $this->path($organisation, 'ire.events/only-ours'));

        self::assertResponseStatusCodeSame(200);
        self::assertSame('off', $this->row($page)['onlyOurs']);
        self::assertNull($this->row($page)['onlyOursFromAt']);
        self::assertSame(['domain' => ['ire.events', 'ire.events'], 'onlyOurs' => ['scheduled', 'off']], $this->audited(OnlyOurOrganisation::CANCELLED, $organisation)->getChanges());
        self::assertSame(0, self::service(OnlyOurOrganisation::class)->applyDue());
    }

    #[Test]
    public function itAppliesAtItsInstantAndTheApplyingIsRecordedAtThatInstant(): void
    {
        [$owner, $organisation] = $this->proved();
        $this->switchOn($owner, $organisation);
        $this->applied();

        self::assertSame(1, self::service(OnlyOurOrganisation::class)->applyDue());
        self::assertSame(0, self::service(OnlyOurOrganisation::class)->applyDue(), 'once');

        $domain = $this->fresh();
        $entry = $this->audited(OnlyOurOrganisation::APPLIED, $organisation);
        self::assertEquals($domain->getOnlyOursFrom(), $entry->getOccurredAt());
        $this->signIn($owner);
        self::assertSame('on', $this->row($this->send('GET', $this->path($organisation)))['onlyOurs']);
    }

    #[Test]
    public function onceAppliedCreatingAnOrganisationIsRefusedAndRecordedOnTheAccountAlone(): void
    {
        [$owner, $organisation] = $this->proved();
        $kemi = $this->member('kemi@ire.events', 'Kemi');
        $this->switchOn($owner, $organisation);
        $this->applied();

        $body = $this->createOrganisation($kemi);

        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::DomainManaged->type(), $body['type']);
        self::assertSame(self::MANAGED, $body['detail']);
        self::assertSame(['Ìrè Events', 'ire.events'], [$body['organisation'], $body['domain']]);
        $entry = $this->refusedFor($kemi);
        self::assertSame('Account', $entry->getSubjectType());
        self::assertSame([null, 'create'], $entry->getChanges()['path']);
        self::assertNull($this->entityManager()->getRepository(AuditEntry::class)->findOneBy(['action' => ManagedAccounts::REFUSED, 'subjectId' => $organisation->getId()]), 'never in the organisation log');

        $this->expectRefusal(static fn () => self::service(OrganisationFounder::class)->found($kemi, 'Kemi Events', 'NG', 'Africa/Lagos'));
    }

    #[Test]
    public function aManagedSignUpWithNothingToJoinCompletesTheDetailsWithNoOrganisationAndCannotNameOne(): void
    {
        [$owner, $organisation] = $this->proved();
        $this->switchOn($owner, $organisation);
        $this->applied();
        $ada = self::service(UserRegistrar::class)->register('ada@ire.events', 'Ada', self::PASSWORD)->user;
        $ada->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
        $this->entityManager()->flush();
        $this->signIn($ada);

        $named = $this->send('PATCH', '/api/auth/complete-profile', ['name' => 'Ada Okeke', 'organisationName' => 'Ada Events', 'countryCode' => 'NG', 'timezone' => 'Africa/Lagos']);

        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::DomainManaged->type(), $named['type']);
        self::assertFalse($this->reloadUser($ada)->hasSavedDetails(), 'nothing saved with the refusal');

        $body = $this->send('PATCH', '/api/auth/complete-profile', ['name' => 'Ada Okeke']);

        self::assertResponseStatusCodeSame(200);
        $account = Type\dict(Type\string(), Type\mixed())->coerce($body['account']);
        self::assertTrue($account['complete'], 'past the onboarding gate');
        self::assertFalse($account['needsOrganisation']);
        self::assertSame([], $this->entityManager()->getRepository(Membership::class)->findBy(['user' => $ada]));
    }

    #[Test]
    public function onceAppliedAnotherOrganisationsInvitationIsRefusedEvenOneSentBeforeAndTheHomeOrganisationsIsNot(): void
    {
        [$owner, $organisation] = $this->proved();
        [$lumenOwner, $lumen] = $this->organisation('ada@lumen.pt', 'Lumen');
        $kemi = $this->member('kemi@ire.events', 'Kemi');
        $sentBefore = self::service(InvitationSender::class)->invite($lumen, 'kemi@ire.events', $this->role($lumen, SeededRole::Member), $lumenOwner);
        $home = self::service(InvitationSender::class)->invite($organisation, 'kemi@ire.events', $this->role($organisation, SeededRole::Member), $owner);
        $this->entityManager()->flush();
        $this->switchOn($owner, $organisation);
        $this->applied();
        $this->signIn($kemi);

        $refused = $this->send('POST', Str\format('/api/invitations/%s/accept', $sentBefore->getId()->toRfc4122()));
        self::assertResponseStatusCodeSame(409);
        self::assertSame(self::MANAGED, $refused['detail']);
        self::assertSame([null, MembershipChannel::Invitation->value], $this->refusedFor($kemi)->getChanges()['path']);

        $this->send('POST', Str\format('/api/invitations/%s/accept', $home->getId()->toRfc4122()));
        self::assertResponseIsSuccessful();
    }

    #[Test]
    public function theListSaysOnEachLoadWhichInvitationsTheAccountCannotAcceptAndTellsTheInvitingOrganisationNothing(): void
    {
        [$owner, $organisation] = $this->proved();
        [$lumenOwner, $lumen] = $this->organisation('ada@lumen.pt', 'Lumen');
        $kemi = $this->member('kemi@ire.events', 'Kemi');
        $elsewhere = self::service(InvitationSender::class)->invite($lumen, 'kemi@ire.events', $this->role($lumen, SeededRole::Member), $lumenOwner);
        $home = self::service(InvitationSender::class)->invite($organisation, 'kemi@ire.events', $this->role($organisation, SeededRole::Member), $owner);
        $this->entityManager()->flush();
        $this->switchOn($owner, $organisation);
        $this->applied();
        $this->signIn($kemi);

        $managed = $this->managedByInvitation();
        self::assertSame(self::MANAGED, Type\shape(['message' => Type\string()], true)->coerce($managed[$elsewhere->getId()->toRfc4122()])['message']);
        self::assertNull($managed[$home->getId()->toRfc4122()]);

        $this->signIn($lumenOwner);
        $members = Json\encode($this->send('GET', Str\format('/api/orgs/%s/members', $lumen->getId()->toRfc4122())));
        self::assertStringContainsString($elsewhere->getId()->toRfc4122(), $members);
        self::assertStringNotContainsString('managed', $members);
        self::assertSame(InvitationStatus::Pending, $this->entityManager()->getRepository(Invitation::class)->find($elsewhere->getId())?->getStatus());

        $this->signIn($owner);
        $this->send('DELETE', $this->path($organisation, 'ire.events/only-ours'));
        $this->signIn($kemi);

        self::assertSame([null, null], Vec\values($this->managedByInvitation()));
    }

    #[Test]
    public function onceAppliedTheRequestLinkAndAnotherListingAreRefused(): void
    {
        [$owner, $organisation] = $this->proved();
        [$lumenOwner, $lumen] = $this->organisation('ada@lumen.pt', 'Lumen');
        $kemi = $this->member('kemi@ire.events', 'Kemi');
        self::service(RequestLinkEditor::class)->turnOn($lumen, $lumenOwner);
        $this->entityManager()->persist(new OrganisationDomain($this->reload($lumen), 'ire.events'));
        $this->entityManager()->flush();
        $this->switchOn($owner, $organisation);
        $this->applied();
        $this->signIn($kemi);
        $token = $this->reload($lumen)->getRequestLinkToken() ?? self::fail('no link');

        $link = $this->send('POST', '/api/request-links/link', ['token' => $token]);
        self::assertSame(self::MANAGED, Type\shape(['message' => Type\string()], true)->coerce($link['managed'])['message']);

        $asked = $this->send('POST', '/api/request-links/ask', ['token' => $token]);
        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::DomainManaged->type(), $asked['type']);

        $this->expectRefusal(fn () => self::service(JoinRequester::class)->ask($this->reloadUser($kemi), $this->reload($lumen)));

        $offers = $this->send('GET', '/api/join-offers');
        self::assertSame('ire.events', Type\shape(['domain' => Type\string()], true)->coerce($offers['managed'])['domain']);
    }

    #[Test]
    public function membershipsHeldElsewhereAreKeptAndCountedForTheHomeOrganisationsAdminsWithoutNames(): void
    {
        [$owner, $organisation] = $this->proved();
        [, $lumen] = $this->organisation('ada@lumen.pt', 'Lumen');
        [, $vela] = $this->organisation('rui@vela.pt', 'Vela');
        $kemi = $this->member('kemi@ire.events', 'Kemi');
        $this->join($lumen, $kemi, SeededRole::Member);
        $this->join($vela, $kemi, SeededRole::Admin);
        $this->join($organisation, $kemi, SeededRole::Member);
        $this->switchOn($owner, $organisation);
        $this->applied();
        $this->signIn($owner);

        $members = Type\vec(Type\shape(['user' => Type\shape(['name' => Type\string()], true), 'alsoMemberOf' => Type\nullable(Type\int())], true))->coerce($this->send('GET', Str\format('/api/orgs/%s/members', $organisation->getId()->toRfc4122()))['members']);
        $byName = Vec\map($members, static fn (array $row): array => [$row['user']['name'], $row['alsoMemberOf']]);

        self::assertContains(['Kemi', 2], $byName);
        self::assertSame(MembershipStatus::Active, $this->entityManager()->getRepository(Membership::class)->findOneBy(['user' => $kemi->getId(), 'organisation' => $lumen->getId()])?->getStatus());
    }

    #[Test]
    public function aMainAddressMovedOffTheDomainFreesTheAccountAtOnce(): void
    {
        [$owner, $organisation] = $this->proved();
        $kemi = $this->member('kemi@ire.events', 'Kemi');
        $this->switchOn($owner, $organisation);
        $this->applied();
        $kemi = $this->reloadUser($kemi);
        $personal = new EmailAddress($kemi, 'kemi@personal.ng');
        $personal->setVerifiedAt(new DateTimeImmutable());
        $this->entityManager()->persist($personal);
        $kemi->getPrimaryEmailAddress()?->setPrimary(false);
        $this->entityManager()->flush();
        $personal->setPrimary(true);
        $this->entityManager()->flush();

        $this->createOrganisation($kemi);

        self::assertResponseStatusCodeSame(201);
    }

    #[Test]
    public function switchingOffFreesEverybodyAndIsAudited(): void
    {
        [$owner, $organisation] = $this->proved();
        $kemi = $this->member('kemi@ire.events', 'Kemi');
        $this->switchOn($owner, $organisation);
        $this->applied();
        $this->signIn($owner);

        $page = $this->send('DELETE', $this->path($organisation, 'ire.events/only-ours'));

        self::assertSame('off', $this->row($page)['onlyOurs']);
        self::assertSame(['domain' => ['ire.events', 'ire.events'], 'onlyOurs' => ['on', 'off']], $this->audited(OnlyOurOrganisation::SWITCHED_OFF, $organisation)->getChanges());
        $this->createOrganisation($kemi);
        self::assertResponseStatusCodeSame(201);
    }

    #[Test]
    public function leavingEnterpriseFreesEverybodyAndKeepsItAsConfigured(): void
    {
        [$owner, $organisation] = $this->proved();
        $kemi = $this->member('kemi@ire.events', 'Kemi');
        $this->switchOn($owner, $organisation);
        $this->applied();
        $this->moveTo($organisation, Plan::Free);

        $this->createOrganisation($kemi);

        self::assertResponseStatusCodeSame(201);
        self::assertNotNull($this->fresh()->getOnlyOursFrom());
    }

    #[Test]
    public function withTheSettingOffAccountsAtTheDomainJoinAndCreateAsBefore(): void
    {
        $this->proved();
        [$lumenOwner, $lumen] = $this->organisation('ada@lumen.pt', 'Lumen');
        $kemi = $this->member('kemi@ire.events', 'Kemi');
        $invitation = self::service(InvitationSender::class)->invite($lumen, 'kemi@ire.events', $this->role($lumen, SeededRole::Member), $lumenOwner);
        $this->entityManager()->flush();
        $this->signIn($kemi);

        $this->send('POST', Str\format('/api/invitations/%s/accept', $invitation->getId()->toRfc4122()));
        self::assertResponseIsSuccessful();
        $this->createOrganisation($kemi);
        self::assertResponseStatusCodeSame(201);
        self::assertNull($this->send('GET', '/api/join-offers')['managed']);
    }

    #[Test]
    public function registeringFromAnotherOrganisationsInvitationIsRefusedAndRecordedAboutTheInvitation(): void
    {
        [$owner, $organisation] = $this->proved();
        [, $lumen] = $this->organisation('ada@lumen.pt', 'Lumen');
        [$invitation, $token] = self::invitationTo('bayo@ire.events', $this->reload($lumen));
        $this->switchOn($owner, $organisation);
        $this->applied();
        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');

        $refused = $this->send('POST', '/api/auth/register', ['email' => 'bayo@ire.events', 'name' => 'Bayo', 'password' => self::PASSWORD, 'invitationToken' => $token]);

        self::assertResponseStatusCodeSame(409);
        self::assertSame(self::MANAGED, $refused['detail']);
        $entry = Type\instance_of(AuditEntry::class)->coerce(
            $this->entityManager()->getRepository(AuditEntry::class)->findOneBy(['action' => ManagedAccounts::REFUSED, 'subjectId' => $invitation->getId()]),
        );
        self::assertSame('Invitation', $entry->getSubjectType());
        self::assertSame([null, $lumen->getId()->toRfc4122()], $entry->getChanges()['organisation']);
    }

    #[Test]
    public function onceAppliedAManagedAccountIsStillGrantedAnotherOrganisationsEventAndReachesIt(): void
    {
        [$owner, $organisation] = $this->proved();
        [$lumenOwner, $lumen] = $this->organisation('ada@lumen.pt', 'Lumen');
        $kemi = $this->member('kemi@ire.events', 'Kemi');
        $this->switchOn($owner, $organisation);
        $this->applied();
        $this->signIn($lumenOwner);
        $event = $this->send('POST', Str\format('/api/orgs/%s/events', $lumen->getId()->toRfc4122()), [
            'name' => 'Owambe', 'type' => 'wedding', 'startsAt' => '2030-11-14T16:00', 'endsAt' => '2030-11-14T16:00', 'timeZone' => 'Africa/Lagos', 'currency' => 'NGN',
        ]);
        self::assertResponseStatusCodeSame(201);
        $eventId = Type\shape(['id' => Type\string()], true)->coerce($event['event'])['id'];

        $this->send('POST', '/api/events/' . $eventId . '/people', ['address' => 'kemi@ire.events', 'role' => 'can_view', 'jobLabel' => null]);
        self::assertResponseStatusCodeSame(201);
        $this->signIn($kemi);
        $this->send('GET', '/api/events/' . $eventId);

        self::assertResponseStatusCodeSame(200);
    }

    /** @return array{User, Organisation} an Enterprise organisation that has proved ire.events */
    private function proved(): array
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->moveTo($organisation, Plan::Enterprise);
        $domain = new EmailDomain($this->reload($organisation), 'ire.events', SecureRandom\string(32), new DateTimeImmutable());
        $this->entityManager()->persist($domain);
        $this->entityManager()->flush();
        ScriptedTxtRecordLookup::publish(EmailDomains::recordName('ire.events'), $domain->getRecordValue());
        $this->signIn($owner);
        $this->send('POST', $this->path($organisation, 'ire.events/verify'));
        self::assertResponseStatusCodeSame(200);

        return [$owner, $organisation];
    }

    /** @return array<string, mixed> GET /api/invitations' `managed`, by invitation id */
    private function managedByInvitation(): array
    {
        $listed = Type\vec(Type\shape(['id' => Type\string(), 'managed' => Type\mixed()], true))->coerce($this->send('GET', '/api/invitations')['invitations']);
        self::assertResponseIsSuccessful();

        return Dict\from_entries(Vec\map($listed, static fn (array $row): array => [$row['id'], $row['managed']]));
    }

    private function switchOn(User $owner, Organisation $organisation): void
    {
        $this->signIn($owner);
        $this->send('POST', $this->path($organisation, 'ire.events/only-ours'));
        self::assertResponseStatusCodeSame(200);
    }

    /** The 14 days over: moved back rather than waited for. */
    private function applied(): void
    {
        $this->entityManager()->getConnection()->executeStatement(
            "UPDATE organisation_email_domains SET only_ours_switched_on_at = only_ours_switched_on_at - INTERVAL '15 days', only_ours_from = only_ours_from - INTERVAL '15 days' WHERE domain = 'ire.events'",
        );
        $this->entityManager()->clear();
    }

    /** @return array<string, mixed> */
    private function createOrganisation(User $user): array
    {
        $this->signIn($user);

        return $this->send('POST', '/api/orgs', ['name' => 'Side Events', 'countryCode' => 'NG', 'timezone' => 'Africa/Lagos']);
    }

    private function expectRefusal(callable $path): void
    {
        try {
            $path();
            self::fail('not refused');
        } catch (ApiException $refusal) {
            self::assertSame(ErrorCode::DomainManaged, $refusal->errorCode);
            self::assertSame(self::MANAGED, $refusal->getMessage());
        }
    }

    private function refusedFor(User $user): AuditEntry
    {
        return Type\instance_of(AuditEntry::class)->coerce(
            $this->entityManager()->getRepository(AuditEntry::class)->findOneBy(['action' => ManagedAccounts::REFUSED, 'subjectId' => $user->getId()], ['occurredAt' => 'DESC']),
        );
    }

    /** @return array{User, Organisation} */
    private function organisation(string $address, string $name): array
    {
        $owner = $this->member($address, 'Owner of ' . $name);
        $organisation = self::service(OrganisationFounder::class)->found($owner, $name, 'NG', 'Africa/Lagos');
        $this->entityManager()->flush();

        return [$owner, $organisation];
    }

    private function moveTo(Organisation $organisation, Plan $plan): void
    {
        self::service(PlanChanger::class)->change($this->reload($organisation), $plan, 'Ada at Soirely', 'A test needs it.');
        $this->entityManager()->flush();
    }

    private function member(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function unverified(string $address): void
    {
        self::service(UserRegistrar::class)->register($address, 'Unverified', self::PASSWORD);
        $this->entityManager()->flush();
    }

    private function join(Organisation $organisation, User $user, SeededRole $as): void
    {
        self::service(MembershipMachine::class)->join($this->reload($organisation), $this->reloadUser($user), $this->role($organisation, $as), MembershipStatus::Active, MembershipChannel::Invitation, null);
        $this->entityManager()->flush();
    }

    private function role(Organisation $organisation, SeededRole $as): Role
    {
        return Type\instance_of(Role::class)->coerce($this->entityManager()->getRepository(Role::class)->findOneBy(['organisation' => $organisation->getId(), 'seededAs' => $as]));
    }

    private function reload(Organisation $organisation): Organisation
    {
        return $this->entityManager()->find(Organisation::class, $organisation->getId()) ?? self::fail('gone');
    }

    private function reloadUser(User $user): User
    {
        return $this->entityManager()->find(User::class, $user->getId()) ?? self::fail('gone');
    }

    private function fresh(): EmailDomain
    {
        $this->entityManager()->clear();

        return Iter\first(self::service(EmailDomainRepository::class)->findBy(['domain' => 'ire.events'])) ?? self::fail('no domain');
    }

    private function audited(string $action, Organisation $organisation): AuditEntry
    {
        return Type\instance_of(AuditEntry::class)->coerce(
            $this->entityManager()->getRepository(AuditEntry::class)->findOneBy(['action' => $action, 'subjectId' => $organisation->getId()]),
        );
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array<string, mixed>
     */
    private function row(array $body): array
    {
        foreach (Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($body['domains']) as $row) {
            if ('ire.events' === $row['domain']) {
                return $row;
            }
        }

        self::fail('no row for ire.events');
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

    private function entityManager(): EntityManagerInterface
    {
        return self::service(EntityManagerInterface::class);
    }

    private function signIn(User $user): void
    {
        $this->entityManager()->flush();
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
