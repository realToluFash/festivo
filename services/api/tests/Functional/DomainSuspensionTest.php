<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\DomainJoining\DomainSuspender;
use App\Domain\Organisation\DomainJoining\JoinRequester;
use App\Domain\Organisation\DomainJoining\RemovalClock;
use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Organisation\Roles\RoleAssignment;
use App\Domain\User\Mail\UserMailer;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\EmailAddress;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\OrganisationDomain;
use App\Entity\ProviderIdentity;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\DomainSuspension;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Http\AfterResponse;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateInterval;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

final class DomainSuspensionTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function changingThePrimaryAddressToAnotherDomainSuspendsAtOnce(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $tunde = $this->domainMember($organisation, 'tunde@ire.events');
        $personal = $this->verifiedAlternative($tunde, 'tunde@okafor.family');
        $this->signIn($tunde);

        $this->send('PATCH', '/api/auth/emails/' . $personal->getId()->toRfc4122() . '/primary', ['proof' => $this->proof()]);

        self::assertResponseStatusCodeSame(200);
        $membership = $this->membershipOf($tunde, $organisation);
        self::assertSame(MembershipStatus::Suspended, $membership->getStatus());
        self::assertSame(DomainSuspension::AddressGone, $membership->getSuspension());
        self::assertNull(self::service(MembershipRepository::class)->findActive($tunde, $organisation->getId()), 'no access to the organisation at all');
        self::assertSame([
            'status' => ['active', 'suspended'],
            'suspension' => [null, 'address_gone'],
        ], $this->audited(DomainSuspender::SUSPENDED, $membership)->getChanges());
    }

    #[Test]
    public function removingTheCompanyAddressLeavesThemSuspendedAndRestoreRefused(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $tunde = $this->domainMember($organisation, 'tunde@ire.events');
        $company = Type\instance_of(EmailAddress::class)->coerce($tunde->getPrimaryEmailAddress());
        $this->verifiedAlternative($tunde, 'tunde@okafor.family');
        $this->makePrimary($tunde, 'tunde@okafor.family');
        $this->signIn($tunde);

        $this->send('DELETE', '/api/auth/emails/' . $company->getId()->toRfc4122());

        self::assertResponseStatusCodeSame(204);
        self::assertSame(MembershipStatus::Suspended, $this->membershipOf($tunde, $organisation)->getStatus());

        $this->signIn($owner);
        $body = $this->send('POST', $this->restorePath($organisation, $tunde));
        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::RestoreNeedsAddress->type(), $body['type'] ?? null);
        self::assertSame('Member needs a verified ire.events address first.', $body['detail'] ?? null);
    }

    #[Test]
    public function restoreIsAllowedOnceTheAddressIsPrimaryAndVerifiedAgain(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $tunde = $this->domainMember($organisation, 'tunde@ire.events');
        $this->verifiedAlternative($tunde, 'tunde@okafor.family');
        $this->makePrimary($tunde, 'tunde@okafor.family');
        $this->makePrimary($tunde, 'tunde@ire.events');
        self::assertSame(MembershipStatus::Suspended, $this->membershipOf($tunde, $organisation)->getStatus(), 'coming back does not restore by itself');
        $this->signIn($owner);

        $this->send('POST', $this->restorePath($organisation, $tunde));

        self::assertResponseStatusCodeSame(204);
        $membership = $this->membershipOf($tunde, $organisation);
        self::assertSame(MembershipStatus::Active, $membership->getStatus());
        self::assertNull($membership->getSuspension());
        self::assertSame([
            'status' => ['suspended', 'active'],
            'suspension' => ['address_gone', null],
        ], $this->audited(DomainSuspender::RESTORED, $membership)->getChanges());
    }

    #[Test]
    public function removingTheDomainFromTheListSuspendsItsMembersAndRestoreNeedsNothing(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $tunde = $this->domainMember($organisation, 'tunde@ire.events');
        $this->signIn($owner);

        $this->send('DELETE', Str\format('/api/orgs/%s/domains/ire.events', $organisation->getId()->toRfc4122()));

        self::assertResponseStatusCodeSame(200);
        self::assertSame(DomainSuspension::DomainClosed, $this->membershipOf($tunde, $organisation)->getSuspension());

        $this->send('POST', $this->restorePath($organisation, $tunde));
        self::assertResponseStatusCodeSame(204);
        self::assertSame(MembershipStatus::Active, $this->membershipOf($tunde, $organisation)->getStatus());
    }

    #[Test]
    public function anotherOrganisationProvingTheDomainSuspendsEveryOtherOrganisationsDomainMembers(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        [, $prover] = $this->organisation('bisi@ire.events', 'Ìrè Group');
        $tunde = $this->domainMember($organisation, 'tunde@ire.events');
        $kemi = $this->domainMember($prover, 'kemi@ire.events');
        $proved = $this->list($prover, 'ire.events');
        $proved->setProvedAt(new DateTimeImmutable());

        self::service(DomainSuspender::class)->domainProved($proved);
        self::service(EntityManagerInterface::class)->flush();

        self::assertSame(DomainSuspension::DomainManagedElsewhere, $this->membershipOf($tunde, $organisation)->getSuspension());
        self::assertSame(MembershipStatus::Active, $this->membershipOf($kemi, $prover)->getStatus(), 'the organisation that proved it keeps its own');
    }

    #[Test]
    public function aSuspensionNobodyAnswersInThirtyDaysEndsAsRemoved(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $due = $this->domainMember($organisation, 'tunde@ire.events');
        $notYet = $this->domainMember($organisation, 'kemi@ire.events');
        $this->suspendAt($this->membershipOf($due, $organisation), new DateTimeImmutable('-720 hours -1 minute'));
        $this->suspendAt($this->membershipOf($notYet, $organisation), new DateTimeImmutable('-719 hours'));

        self::assertSame(1, self::service(DomainSuspender::class)->removeExpired());
        self::service(EntityManagerInterface::class)->flush();

        $removed = $this->membershipOf($due, $organisation);
        self::assertSame(MembershipStatus::LeftOrRemoved, $removed->getStatus());
        self::assertSame(MembershipStatus::Suspended, $this->membershipOf($notYet, $organisation)->getStatus());
        self::assertSame([
            'status' => ['suspended', 'left_or_removed'],
            'suspension' => ['address_gone', null],
        ], $this->audited(DomainSuspender::EXPIRED, $removed)->getChanges());
    }

    #[Test]
    public function theOnlyOwnerIsSuspendedButNeverRemovedAndNoRemovalIsShown(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $administrator = $this->member('bisi@ire.events');
        $this->join($organisation, $administrator, MembershipChannel::Invitation, SeededRole::Administrator);
        $membership = $this->membershipOf($owner, $organisation);
        $membership->setDomain('ire.events');
        $this->verifiedAlternative($owner, 'folake@okafor.family');

        $this->makePrimary($owner, 'folake@okafor.family');

        $membership = $this->membershipOf($owner, $organisation);
        self::assertSame(MembershipStatus::Suspended, $membership->getStatus());
        self::assertTrue($membership->getRole()->isOwner(), 'still Owner');
        self::assertNull($membership->getRemovesAt());
        $text = (string) $this->mails()[0]->getTextBody();
        self::assertStringNotContainsString('If nobody answers', $text);
        self::assertStringNotContainsString('or remove them', $text);
        self::assertStringContainsString('is the only owner of Ìrè Events, so they stay an owner and are not removed.', $text);
        self::assertStringContainsString('Restore them once they have a verified ire.events address again.', $text);

        $this->signIn($owner);
        $paused = Type\vec(Type\shape(['suspension' => Type\shape(['removesAt' => Type\mixed()], true)], true))->coerce($this->send('GET', '/api/orgs')['paused']);
        self::assertNull($paused[0]['suspension']['removesAt']);

        $this->signIn($administrator);
        $members = Type\vec(Type\shape(['id' => Type\string(), 'suspension' => Type\mixed()], true))->coerce(
            $this->send('GET', Str\format('/api/orgs/%s/members', $organisation->getId()->toRfc4122()))['members'],
        );
        $row = Iter\search($members, static fn (array $member): bool => $member['id'] === $membership->getId()->toRfc4122()) ?? self::fail('not listed');
        self::assertNull(Type\shape(['removesAt' => Type\mixed()], true)->coerce($row['suspension'])['removesAt']);

        $this->send('DELETE', Str\format('/api/orgs/%s/members/%s', $organisation->getId()->toRfc4122(), $membership->getId()->toRfc4122()));
        self::assertResponseStatusCodeSame(403);

        try {
            self::service(RoleAssignment::class)->release($membership);
            self::fail('the last owner was released');
        } catch (ApiException $refused) {
            self::assertSame(ErrorCode::LastOwner, $refused->errorCode);
        }

        $this->suspendAt($membership, new DateTimeImmutable('-720 hours -1 minute'));
        self::assertSame(0, self::service(DomainSuspender::class)->removeExpired());
        self::service(EntityManagerInterface::class)->flush();
        self::assertSame(MembershipStatus::Suspended, $this->membershipOf($owner, $organisation)->getStatus());
    }

    #[Test]
    public function aSuspendedOwnerBesideAnotherOwnerIsRemovedAtThirtyDays(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $second = $this->member('bisi@ire.events');
        $this->join($organisation, $second, MembershipChannel::Invitation, SeededRole::Owner);
        $membership = $this->membershipOf($owner, $organisation);
        $this->suspendAt($membership, new DateTimeImmutable('-720 hours -1 minute'));

        self::assertNotNull($membership->getRemovesAt());
        self::assertSame(1, self::service(DomainSuspender::class)->removeExpired());
        self::service(EntityManagerInterface::class)->flush();
        self::assertSame(MembershipStatus::LeftOrRemoved, $this->membershipOf($owner, $organisation)->getStatus());
    }

    #[Test]
    public function aSecondOwnerArrivingAfterThirtyDaysStartsAFreshThirtyDaysFromThatMoment(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $membership = $this->membershipOf($owner, $organisation);
        $this->suspendAt($membership, new DateTimeImmutable('-40 days'));
        self::assertNull($this->membershipOf($owner, $organisation)->getRemovesAt());

        $before = new DateTimeImmutable('+720 hours -1 second');
        $this->join($organisation, $this->member('bisi@ire.events'), MembershipChannel::Invitation, SeededRole::Owner);
        $after = new DateTimeImmutable('+720 hours +1 second');

        $removesAt = $this->membershipOf($owner, $organisation)->getRemovesAt() ?? self::fail('no fresh 30 days');
        self::assertGreaterThanOrEqual($before, $removesAt);
        self::assertLessThanOrEqual($after, $removesAt);
        self::assertSame(0, self::service(DomainSuspender::class)->removeExpired(), 'not at the next sweep');
        self::service(EntityManagerInterface::class)->flush();
        self::assertSame(MembershipStatus::Suspended, $this->membershipOf($owner, $organisation)->getStatus());

        $this->signIn($owner);
        $paused = Type\vec(Type\shape(['suspension' => Type\shape(['removesAt' => Type\shape(['at' => Type\string()], true)], true)], true))->coerce($this->send('GET', '/api/orgs')['paused']);
        self::assertSame($removesAt->format(\DATE_ATOM), $paused[0]['suspension']['removesAt']['at']);
    }

    #[Test]
    public function theFreshThirtyDaysAreOffWhenTheyAreTheOnlyOwnerAgain(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->suspendAt($this->membershipOf($owner, $organisation), new DateTimeImmutable('-40 days'));
        $second = $this->member('bisi@ire.events');
        $this->join($organisation, $second, MembershipChannel::Invitation, SeededRole::Owner);
        self::assertNotNull($this->membershipOf($owner, $organisation)->getRemovesAt());

        $this->membershipOf($second, $organisation)->setDomain('ire.events');
        $this->verifiedAlternative($second, 'bisi@okafor.family');
        $this->makePrimary($second, 'bisi@okafor.family');

        self::assertNull($this->membershipOf($owner, $organisation)->getRemovesAt());
        self::assertNull($this->membershipOf($second, $organisation)->getRemovesAt());
        self::assertSame(0, self::service(DomainSuspender::class)->removeExpired());
    }

    #[Test]
    public function theirOtherOrganisationsAreUntouched(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        [, $family] = $this->organisation('ada@okafor.family', 'Okafor Family');
        $tunde = $this->domainMember($organisation, 'tunde@ire.events');
        $this->join($family, $tunde, MembershipChannel::Invitation);
        $this->verifiedAlternative($tunde, 'tunde@okafor.family');

        $this->makePrimary($tunde, 'tunde@okafor.family');

        self::assertSame(MembershipStatus::Suspended, $this->membershipOf($tunde, $organisation)->getStatus());
        self::assertSame(MembershipStatus::Active, $this->membershipOf($tunde, $family)->getStatus());
    }

    #[Test]
    public function anInvitedMemberAtTheSameDomainIsNotSuspended(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $invited = $this->member('tunde@ire.events');
        $this->join($organisation, $invited, MembershipChannel::Invitation);
        $this->verifiedAlternative($invited, 'tunde@okafor.family');
        $this->makePrimary($invited, 'tunde@okafor.family');
        $this->signIn($owner);

        $this->send('DELETE', Str\format('/api/orgs/%s/domains/ire.events', $organisation->getId()->toRfc4122()));

        self::assertSame(MembershipStatus::Active, $this->membershipOf($invited, $organisation)->getStatus());
        self::assertNull($this->membershipOf($invited, $organisation)->getDomain());
    }

    #[Test]
    public function aDomainRequestAnsweredByAnInvitationIsNotTiedToTheDomain(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $tunde = $this->member('tunde@ire.events');
        self::service(JoinRequester::class)->ask($tunde, $organisation);
        self::service(EntityManagerInterface::class)->flush();
        self::assertSame('ire.events', $this->membershipOf($tunde, $organisation)->getDomain());

        $this->join($organisation, $tunde, MembershipChannel::Invitation);
        $this->verifiedAlternative($tunde, 'tunde@gmail.com');
        $this->makePrimary($tunde, 'tunde@gmail.com');

        self::assertSame(MembershipStatus::Active, $this->membershipOf($tunde, $organisation)->getStatus());
        self::assertNull($this->membershipOf($tunde, $organisation)->getDomain());
    }

    #[Test]
    public function unlinkingTheCompanyGoogleAccountSuspendsNobody(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $tunde = $this->domainMember($organisation, 'tunde@ire.events');
        self::service(EntityManagerInterface::class)->persist(new ProviderIdentity($tunde, IdentityProvider::Google, 'g-tunde', 'tunde@ire.events'));
        $this->signIn($tunde);

        $this->send('POST', '/api/auth/providers/google/unlink', ['proof' => $this->proof()]);

        self::assertResponseIsSuccessful();
        self::assertSame(MembershipStatus::Active, $this->membershipOf($tunde, $organisation)->getStatus());
        self::assertSame('ire.events', $this->membershipOf($tunde, $organisation)->getDomain());
    }

    #[Test]
    public function theAdministratorsAreEmailedTheOneRemovalInstantEachInTheirOwnZone(): void
    {
        [$lagos, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $lagos->setTimezone('Africa/Lagos');
        $london = $this->member('bisi@ire.events');
        $london->setTimezone('Europe/London');
        $this->join($organisation, $london, MembershipChannel::Invitation, SeededRole::Administrator);
        $coordinator = $this->member('kemi@ire.events');
        $this->join($organisation, $coordinator, MembershipChannel::Invitation, SeededRole::Coordinator);
        $tunde = $this->domainMember($organisation, 'tunde@ire.events');
        $membership = $this->membershipOf($tunde, $organisation);
        $this->suspendAt($membership, new DateTimeImmutable('2026-10-17 13:20:00 UTC'));

        self::assertSame('2026-11-16T13:20:00+00:00', $membership->getRemovesAt()?->format(\DATE_ATOM));

        $mailer = self::service(UserMailer::class);
        $at = $membership->getRemovesAt() ?? self::fail('no removal');
        self::assertSame('Monday, Nov 16 at 14:20 WAT', $mailer->deadline($at, $lagos, 'en'));
        self::assertSame('Monday, Nov 16 at 13:20 GMT', $mailer->deadline($at, $london, 'en'));
    }

    #[Test]
    public function theSuspensionEmailGoesToOwnersAndAdministratorsAlone(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $owner->setTimezone('Africa/Lagos');
        $coordinator = $this->member('kemi@ire.events');
        $this->join($organisation, $coordinator, MembershipChannel::Invitation, SeededRole::Coordinator);
        $tunde = $this->domainMember($organisation, 'tunde@ire.events', 'Tunde Bakare');
        $this->verifiedAlternative($tunde, 'tunde@okafor.family');

        $this->makePrimary($tunde, 'tunde@okafor.family');

        $mails = $this->mails();
        self::assertCount(1, $mails);
        self::assertSame(['folake@ire.events'], Vec\map($mails[0]->getTo(), static fn (Address $to): string => $to->getAddress()));
        self::assertSame("Tunde Bakare's access to Ìrè Events is paused", $mails[0]->getSubject());
        $text = (string) $mails[0]->getTextBody();
        self::assertStringContainsString('because their ire.events address is no longer on their account.', $text);
        self::assertStringContainsString('If nobody answers by ' . self::service(UserMailer::class)->deadline(
            $this->membershipOf($tunde, $organisation)->getRemovesAt() ?? self::fail('no removal'),
            $owner,
            'en',
        ) . ', they are removed.', $text);
        self::assertStringContainsString('Review Tunde Bakare: ', $text);
        self::assertStringContainsString("You're getting this because you're an admin of Ìrè Events.", $text);
    }

    #[Test]
    public function noEmailGoesOutForASuspensionThatNeverCommits(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $tunde = $this->domainMember($organisation, 'tunde@ire.events', 'Tunde Bakare');
        $this->verifiedAlternative($tunde, 'tunde@okafor.family');
        $entityManager = self::service(EntityManagerInterface::class);
        $connection = $entityManager->getConnection();

        $connection->beginTransaction();
        Iter\search($tunde->getEmailAddresses(), static fn (EmailAddress $held): bool => $held->isPrimary())?->setPrimary(false);
        $entityManager->flush();
        Iter\search($tunde->getEmailAddresses(), static fn (EmailAddress $held): bool => 'tunde@okafor.family' === $held->getAddress())?->setPrimary(true);
        self::service(DomainSuspender::class)->addressChanged($tunde);
        $entityManager->flush();
        $connection->rollBack();
        self::service(AfterResponse::class)->run();

        self::assertSame([], $this->mails());
    }

    #[Test]
    public function thePausedPersonIsToldWhyAndWhenAndTheMemberPageShowsIt(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $tunde = $this->domainMember($organisation, 'tunde@ire.events');
        $this->verifiedAlternative($tunde, 'tunde@okafor.family');
        $this->makePrimary($tunde, 'tunde@okafor.family');
        $membership = $this->membershipOf($tunde, $organisation);
        $owner->setTimezone('Africa/Lagos');
        $tunde->setTimezone('Europe/London');
        $since = $membership->getSuspendedAt() ?? self::fail('not suspended');
        $removesAt = $membership->getRemovesAt() ?? self::fail('no removal');
        $mailer = self::service(UserMailer::class);
        $suspension = static fn (User $reader): array => [
            'reason' => 'address_gone',
            'domain' => 'ire.events',
            'since' => ['at' => $since->format(\DATE_ATOM), 'written' => $mailer->deadline($since, $reader, 'en')],
            'removesAt' => ['at' => $removesAt->format(\DATE_ATOM), 'written' => $mailer->deadline($removesAt, $reader, 'en')],
        ];

        $this->signIn($tunde);
        $body = $this->send('GET', '/api/orgs');
        $paused = Type\vec(Type\shape(['name' => Type\string(), 'suspension' => Type\mixed()], true))->coerce($body['paused']);
        self::assertSame('Ìrè Events', $paused[0]['name']);
        self::assertSame($suspension($tunde), $paused[0]['suspension']);
        self::assertStringEndsWith(' GMT', $suspension($tunde)['removesAt']['written']);
        self::assertFalse(Iter\any(
            Type\vec(Type\shape(['id' => Type\string()], true))->coerce($body['organisations']),
            static fn (array $listed): bool => $listed['id'] === $organisation->getId()->toRfc4122(),
        ));

        $this->signIn($owner);
        $members = Type\vec(Type\shape(['id' => Type\string(), 'suspension' => Type\mixed()], true))->coerce(
            $this->send('GET', Str\format('/api/orgs/%s/members', $organisation->getId()->toRfc4122()))['members'],
        );
        $row = Iter\search($members, static fn (array $member): bool => $member['id'] === $membership->getId()->toRfc4122()) ?? self::fail('not listed');
        self::assertSame($suspension($owner), $row['suspension']);
        self::assertStringEndsWith(' WAT', $suspension($owner)['removesAt']['written']);
    }

    #[Test]
    public function anAdministratorCanRemoveASuspendedMember(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $tunde = $this->domainMember($organisation, 'tunde@ire.events');
        $this->suspendAt($this->membershipOf($tunde, $organisation), new DateTimeImmutable());
        $this->signIn($owner);

        $this->send('DELETE', Str\format('/api/orgs/%s/members/%s', $organisation->getId()->toRfc4122(), $this->membershipOf($tunde, $organisation)->getId()->toRfc4122()));

        self::assertResponseStatusCodeSame(204);
        self::assertSame(MembershipStatus::LeftOrRemoved, $this->membershipOf($tunde, $organisation)->getStatus());
    }

    #[Test]
    public function anActiveMemberCannotBeRestored(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $tunde = $this->domainMember($organisation, 'tunde@ire.events');
        $this->signIn($owner);

        $this->send('POST', $this->restorePath($organisation, $tunde));

        self::assertResponseStatusCodeSame(409);
    }

    /** @return array{User, Organisation} */
    private function organisation(string $ownerAddress, string $name): array
    {
        $owner = $this->member($ownerAddress);
        $organisation = self::service(OrganisationFounder::class)->found($owner, $name, 'NG', 'Africa/Lagos');
        self::service(EntityManagerInterface::class)->flush();

        return [$owner, $organisation];
    }

    private function member(string $address, string $name = 'Member'): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    /** In as sc-392's approval will let them: through the domain, at active. */
    private function domainMember(Organisation $organisation, string $address, string $name = 'Member'): User
    {
        $user = $this->member($address, $name);
        $this->join($organisation, $user, MembershipChannel::Domain);

        return $user;
    }

    private function join(Organisation $organisation, User $user, MembershipChannel $channel, SeededRole $as = SeededRole::ReadOnly): void
    {
        $role = Type\instance_of(Role::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $as]),
        );
        self::service(MembershipMachine::class)->join($organisation, $user, $role, MembershipStatus::Active, $channel, $user);
        self::service(EntityManagerInterface::class)->flush();
    }

    private function verifiedAlternative(User $user, string $address): EmailAddress
    {
        $added = new EmailAddress($user, Type\non_empty_string()->assert($address));
        $added->setVerifiedAt(new DateTimeImmutable());
        self::service(EntityManagerInterface::class)->persist($added);
        self::service(EntityManagerInterface::class)->flush();

        return $added;
    }

    /** As Account settings does, without the proof: the endpoint is covered by the first test. */
    private function makePrimary(User $user, string $address): void
    {
        $entityManager = self::service(EntityManagerInterface::class);

        foreach ($user->getEmailAddresses() as $held) {
            $held->setPrimary(false);
        }

        $entityManager->flush();
        Iter\search($user->getEmailAddresses(), static fn (EmailAddress $held): bool => $held->getAddress() === $address)?->setPrimary(true);
        self::service(DomainSuspender::class)->addressChanged($user);
        $entityManager->flush();
        self::service(AfterResponse::class)->run();
    }

    private function suspendAt(Membership $membership, DateTimeImmutable $at): void
    {
        if (MembershipStatus::Active === $membership->getStatus()) {
            $membership->setStatus(MembershipStatus::Suspended, $at);
        }

        $membership->setSuspension(DomainSuspension::AddressGone, $at);
        self::service(RemovalClock::class)->wind($membership);

        if (null !== $membership->getRemovesAt()) {
            $membership->setRemovesAt($at->add(new DateInterval(RemovalClock::REMOVAL_AFTER)));
        }

        self::service(EntityManagerInterface::class)->flush();
    }

    private function list(Organisation $organisation, string $domain): OrganisationDomain
    {
        $listing = new OrganisationDomain($organisation, $domain);
        self::service(EntityManagerInterface::class)->persist($listing);
        self::service(EntityManagerInterface::class)->flush();

        return $listing;
    }

    private function membershipOf(User $user, Organisation $organisation): Membership
    {
        $membership = self::service(MembershipRepository::class)->findOneBy(['user' => $user, 'organisation' => $organisation]);
        self::assertNotNull($membership);
        self::service(EntityManagerInterface::class)->refresh($membership);

        return $membership;
    }

    private function restorePath(Organisation $organisation, User $user): string
    {
        return Str\format('/api/orgs/%s/members/%s/restore', $organisation->getId()->toRfc4122(), $this->membershipOf($user, $organisation)->getId()->toRfc4122());
    }

    private function audited(string $action, Membership $subject): AuditEntry
    {
        return Type\instance_of(AuditEntry::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(AuditEntry::class)->findOneBy(['action' => $action, 'subjectId' => $subject->getId()]),
        );
    }

    /** @return list<Email> */
    private function mails(): array
    {
        return Vec\map(Vec\filter(
            self::getMailerMessages(),
            static fn (object $message): bool => $message instanceof Email && Str\ends_with((string) $message->getSubject(), 'is paused'),
        ), static fn (object $message): Email => Type\instance_of(Email::class)->coerce($message));
    }

    private function proof(): string
    {
        $body = $this->send('POST', '/api/auth/proof', ['password' => self::PASSWORD]);

        return Type\string()->coerce($body['proof'] ?? self::fail(Json\encode($body)));
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
