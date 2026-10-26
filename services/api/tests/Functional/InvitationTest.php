<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\User\TokenIssuer;
use App\Entity\EmailAddress;
use App\Entity\Invitation;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\InvitationDelivery;
use App\Enum\InvitationStatus;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Repository\EmailAddressRepository;
use App\Tests\ApiTestCase;
use App\Tests\Double\FailingFlushListener;
use App\Tests\Traits\InvitesPeople;
use DateTimeImmutable;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\ORM\Events;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Mime\Email;

final class InvitationTest extends ApiTestCase
{
    use InvitesPeople;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a long enough passphrase';

    // Bob takes Alice's invitation: the one test here whose absence is a privilege escalation.
    #[Test]
    public function aValidTokenWithAnotherAddressCreatesNothing(): void
    {
        [$invitation, $token] = self::invitationTo('alice@example.com');

        $body = $this->register('bob@example.com', $token);

        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::InvitationNotYours->type(), $body['type']);
        $this->assertNoAccount('bob@example.com');
        $this->assertNoAccount('alice@example.com');
        self::assertSame(InvitationStatus::Pending, $this->reloaded($invitation)->getStatus(), 'Alice can still accept it');
        self::assertSame(1, $this->memberships($invitation), 'nobody joined but the founder');
    }

    /** @return iterable<string, array{string, int, ErrorCode}> */
    public static function badTokens(): iterable
    {
        yield 'invented' => ['invented', 404, ErrorCode::InvitationNotFound];
        yield 'expired' => ['expired', 410, ErrorCode::InvitationExpired];
        yield 'revoked' => ['revoked', 410, ErrorCode::InvitationRevoked];
    }

    #[Test]
    #[DataProvider('badTokens')]
    public function aBadTokenCreatesNoAccountAtAll(string $kind, int $status, ErrorCode $code): void
    {
        [$invitation, $token] = self::invitationTo('kemi@example.com');
        match ($kind) {
            'invented' => $token = Str\repeat('ab', 32),
            'expired' => $invitation->setExpiresAt(new DateTimeImmutable('-1 minute')),
            default => $invitation->setStatus(InvitationStatus::Revoked),
        };
        self::em()->flush();

        $body = $this->register('kemi@example.com', $token);

        self::assertSame($status, $this->statusCode());
        self::assertSame($code->type(), $body['type']);
        $this->assertNoAccount('kemi@example.com');
    }

    #[Test]
    public function anAddressThatAlreadyHasAnAccountIsTaken(): void
    {
        self::inviter('kemi@example.com', 'Kemi Lawal');
        [, $token] = self::invitationTo('kemi@example.com');

        $body = $this->register('kemi@example.com', $token);

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::EmailTaken->type(), $body['type']);
    }

    #[Test]
    public function withoutATokenRegistrationIsUnchanged(): void
    {
        $body = $this->call('POST', '/api/auth/register', ['email' => 'plain@example.com', 'name' => 'Plain', 'password' => self::PASSWORD]);

        self::assertSame(202, $this->statusCode());
        self::assertArrayHasKey('registration', $body, 'a code is sent, and no account exists until it is entered');
        $this->assertNoAccount('plain@example.com');
    }

    #[Test]
    public function aStrangerAcceptsByRegisteringVerifiedAndActive(): void
    {
        [$invitation, $token] = self::invitationTo('kemi@example.com');

        $body = $this->register('  Kemi@Example.com ', $token);

        self::assertSame(201, $this->statusCode());
        self::assertArrayHasKey('accessToken', $body);
        $user = $this->accountAt('kemi@example.com');
        self::assertTrue($user->isVerified(), 'the link proved the address');
        self::assertSame(MembershipStatus::Active, $this->membershipOf($user, $invitation)?->getStatus());
        self::assertSame(SeededRole::EventManager, $this->membershipOf($user, $invitation)?->getRole()->getSeededAs());
        $accepted = $this->reloaded($invitation);
        self::assertSame(InvitationStatus::Accepted, $accepted->getStatus());
        self::assertNotNull($accepted->getAcceptedAt());
        self::assertSame($user->getId()->toRfc4122(), $accepted->getAcceptedBy()?->getId()->toRfc4122());
    }

    #[Test]
    public function aFailureInAnyWriteLeavesNoneOfThem(): void
    {
        [$invitation, $token] = self::invitationTo('kemi@example.com');
        $this->client->disableReboot();
        $this->client->catchExceptions(true);
        $failing = new FailingFlushListener(Membership::class);
        self::em()->getEventManager()->addEventListener([Events::onFlush], $failing);

        $this->register('kemi@example.com', $token);

        self::assertSame(1, $failing->failures, 'the membership write was the one made to fail');
        self::assertSame(500, $this->statusCode());
        $connection = self::em()->getConnection();
        self::assertSame(0, (int) $connection->fetchOne("SELECT COUNT(*) FROM email_addresses WHERE address = 'kemi@example.com'"), 'no account');
        self::assertSame('pending', $connection->fetchOne('SELECT status FROM invitations WHERE id = ?', [$invitation->getId()->toRfc4122()]), 'not accepted');
    }

    #[Test]
    public function anAccountAcceptsAndOnlyAMembershipIsCreated(): void
    {
        $kemi = self::inviter('kemi@example.com', 'Kemi Lawal');
        [$invitation] = self::invitationTo('kemi@example.com');

        $body = $this->as($kemi)->call('POST', $this->path($invitation, 'accept'));

        self::assertSame(200, $this->statusCode());
        self::assertSame($invitation->getOrganisationName(), Type\shape(['name' => Type\string()], true)->coerce($body['organisation'])['name']);
        self::assertSame(MembershipStatus::Active, $this->membershipOf($kemi, $invitation)?->getStatus());
        self::assertSame('Kemi Lawal', $this->accountAt('kemi@example.com')->getName(), 'nothing about the account changed');
    }

    #[Test]
    public function acceptingOverAFormerMembershipReactivatesIt(): void
    {
        $kemi = self::inviter('kemi@example.com', 'Kemi Lawal');
        [$first] = self::invitationTo('kemi@example.com');
        $organisation = Type\instance_of(Organisation::class)->coerce($first->getOrganisation());
        $first->setStatus(InvitationStatus::Accepted);
        $old = self::service(MembershipMachine::class)->join($organisation, $kemi, $this->role($organisation, SeededRole::ReadOnly), MembershipStatus::Active, MembershipChannel::Invitation, $kemi);
        self::service(MembershipMachine::class)->move($old, MembershipStatus::LeftOrRemoved, MembershipChannel::Invitation, $kemi);
        self::em()->flush();
        [$again] = self::invitationTo('kemi@example.com', $organisation);

        $this->as($kemi)->call('POST', $this->path($again, 'accept'));

        self::assertSame(200, $this->statusCode());
        $membership = $this->membershipOf($kemi, $again);
        self::assertSame($old->getId()->toRfc4122(), $membership?->getId()->toRfc4122(), 'the same row');
        self::assertSame(MembershipStatus::Active, $membership?->getStatus());
    }

    #[Test]
    public function decliningCreatesNoMembership(): void
    {
        $kemi = self::inviter('kemi@example.com', 'Kemi Lawal');
        [$invitation] = self::invitationTo('kemi@example.com');

        $body = $this->as($kemi)->call('POST', $this->path($invitation, 'decline'));

        self::assertSame(200, $this->statusCode());
        self::assertSame('declined', $body['status']);
        self::assertNull($this->membershipOf($kemi, $invitation));
        self::assertNotNull($this->reloaded($invitation)->getDeclinedAt());
    }

    /** @return iterable<string, array{string}> */
    public static function answers(): iterable
    {
        yield 'accept' => ['accept'];
        yield 'decline' => ['decline'];
    }

    #[Test]
    #[DataProvider('answers')]
    public function somebodyElseCannotAnswerIt(string $answer): void
    {
        $folake = self::inviter('folake@ire.events', 'Folake');
        [$invitation] = self::invitationTo('kemi@example.com');

        $body = $this->as($folake)->call('POST', $this->path($invitation, $answer));

        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::InvitationNotYours->type(), $body['type']);
        self::assertSame(InvitationStatus::Pending, $this->reloaded($invitation)->getStatus());
        self::assertNull($this->membershipOf($folake, $invitation));
    }

    #[Test]
    #[DataProvider('answers')]
    public function somebodyElseLearnsNothingOfAnAcceptedOne(string $answer): void
    {
        $folake = self::inviter('folake@ire.events', 'Folake');
        [$invitation, $token] = self::invitationTo('kemi@example.com');
        $invitation->setStatus(InvitationStatus::Accepted);
        self::em()->flush();

        $body = $this->as($folake)->call('POST', $this->path($invitation, $answer));

        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::InvitationNotYours->type(), $body['type']);
        self::assertFalse($this->as($folake)->call('POST', '/api/invitations/link', ['token' => $token])['forYou'], 'and the link says it is not theirs');
    }

    #[Test]
    public function anUnverifiedAddressIsNotYours(): void
    {
        $kemi = self::inviter('kemi@example.com', 'Kemi Lawal');
        $kemi->getPrimaryEmailAddress()?->setVerifiedAt(null);
        self::em()->flush();
        [$invitation] = self::invitationTo('kemi@example.com');

        $body = $this->as($kemi)->call('POST', $this->path($invitation, 'accept'));

        self::assertSame(ErrorCode::InvitationNotYours->type(), $body['type']);
    }

    /** @return iterable<string, array{InvitationStatus|null, int, ErrorCode}> */
    public static function refusals(): iterable
    {
        yield 'expired' => [null, 410, ErrorCode::InvitationExpired];
        yield 'revoked' => [InvitationStatus::Revoked, 410, ErrorCode::InvitationRevoked];
        yield 'already accepted' => [InvitationStatus::Accepted, 409, ErrorCode::InvitationAccepted];
        yield 'already declined' => [InvitationStatus::Declined, 409, ErrorCode::InvitationDeclined];
    }

    #[Test]
    #[DataProvider('refusals')]
    public function eachRefusalHasItsOwnCode(?InvitationStatus $state, int $status, ErrorCode $code): void
    {
        $kemi = self::inviter('kemi@example.com', 'Kemi Lawal');
        [$invitation, $token] = self::invitationTo('kemi@example.com');
        null === $state ? $invitation->setExpiresAt(new DateTimeImmutable('-1 second')) : $invitation->setStatus($state);
        self::em()->flush();

        $body = $this->as($kemi)->call('POST', $this->path($invitation, 'accept'));

        self::assertSame($status, $this->statusCode());
        self::assertSame($code->type(), $body['type']);
        self::assertSame($code->value, $this->call('POST', '/api/invitations/link', ['token' => $token])['refusal'], 'and the link says which');
    }

    #[Test]
    public function anInvitationToADeletedOrganisationSaysSo(): void
    {
        $kemi = self::inviter('kemi@example.com', 'Kemi Lawal');
        [$invitation, $token] = self::invitationTo('kemi@example.com');
        self::em()->remove(Type\instance_of(Organisation::class)->coerce($invitation->getOrganisation()));
        self::em()->flush();
        self::em()->clear();

        $link = $this->call('POST', '/api/invitations/link', ['token' => $token]);
        $body = $this->as($kemi)->call('POST', $this->path($invitation, 'accept'));

        self::assertSame('organisation_deleted', $link['refusal']);
        self::assertSame('Ìrè Events', Type\shape(['name' => Type\string()], true)->coerce($link['organisation'])['name'], 'still named, to say what is gone');
        self::assertSame(410, $this->statusCode());
        self::assertSame(ErrorCode::OrganisationDeleted->type(), $body['type']);
    }

    #[Test]
    public function aSecondPendingInvitationForOneAddressIsRefused(): void
    {
        [$first] = self::invitationTo('kemi@example.com');

        $this->expectException(UniqueConstraintViolationException::class);
        self::invitationTo('kemi@example.com', $first->getOrganisation());
    }

    #[Test]
    public function aDeclineMakesRoomForANewOne(): void
    {
        [$first] = self::invitationTo('kemi@example.com');
        $first->setStatus(InvitationStatus::Declined);
        self::em()->flush();

        [$second] = self::invitationTo('kemi@example.com', $first->getOrganisation());

        self::assertFalse($second->getId()->equals($first->getId()));
    }

    #[Test]
    public function twoOrganisationsMayEachInviteOneAddress(): void
    {
        [$ire] = self::invitationTo('kemi@example.com');
        [$okafor] = self::invitationTo('kemi@example.com');

        self::assertNotSame($ire->getOrganisation(), $okafor->getOrganisation());
        self::assertSame(InvitationStatus::Pending, $ire->getStatus());
        self::assertSame(InvitationStatus::Pending, $okafor->getStatus());
    }

    #[Test]
    public function reInvitingReplacesTheTokenOnTheSameRow(): void
    {
        [$organisation, $owner] = $this->organisation();

        $this->as($owner)->invite($organisation, 'kemi@example.com', SeededRole::Coordinator);
        $firstToken = $this->linkToken();
        $this->as($owner)->invite($organisation, 'KEMI@example.com', SeededRole::EventManager);
        $secondToken = $this->linkToken();

        self::assertNotSame($firstToken, $secondToken);
        $rows = self::em()->getRepository(Invitation::class)->findBy(['email' => 'kemi@example.com']);
        self::assertCount(1, $rows, 'one row, not two');
        self::assertSame(SeededRole::EventManager, $rows[0]->getRole()?->getSeededAs(), 'carrying the newer role');
        self::assertSame(ErrorCode::InvitationNotFound->type(), $this->call('POST', '/api/invitations/link', ['token' => $firstToken])['type'], 'the old link stops working');
        self::assertNull($this->call('POST', '/api/invitations/link', ['token' => $secondToken])['refusal']);
    }

    #[Test]
    public function onlyTheTokensHashIsStoredAndTheHashOpensNothing(): void
    {
        [$organisation, $owner] = $this->organisation();
        $this->as($owner)->invite($organisation, 'kemi@example.com', SeededRole::Coordinator);
        $token = $this->linkToken();
        $stored = Type\string()->coerce(self::em()->getConnection()->fetchOne("SELECT token_hash FROM invitations WHERE email = 'kemi@example.com'"));

        self::assertNotSame($token, $stored);
        self::assertSame(TokenIssuer::hash($token), $stored);
        self::assertSame(ErrorCode::InvitationNotFound->type(), $this->call('POST', '/api/invitations/link', ['token' => $stored])['type']);
        $this->register('kemi@example.com', $stored);
        $this->assertNoAccount('kemi@example.com');
    }

    #[Test]
    public function sendingNeedsTheMembersPermission(): void
    {
        [$organisation] = $this->organisation();
        $coordinator = self::inviter('coordinator@ire.events', 'Chidi Okoro');
        self::service(MembershipMachine::class)->join($organisation, $coordinator, $this->role($organisation, SeededRole::Coordinator), MembershipStatus::Active, MembershipChannel::Invitation, $coordinator);
        self::em()->flush();

        $body = $this->as($coordinator)->invite($organisation, 'kemi@example.com', SeededRole::Coordinator);

        self::assertSame(403, $this->statusCode());
        self::assertSame(ErrorCode::PermissionRequired->type(), $body['type']);
        self::assertSame([], self::em()->getRepository(Invitation::class)->findBy(['email' => 'kemi@example.com']));
    }

    #[Test]
    public function anAdministratorCannotInviteAnOwner(): void
    {
        [$organisation] = $this->organisation();
        $admin = self::inviter('admin@ire.events', 'Bisi Adeyemi');
        self::service(MembershipMachine::class)->join($organisation, $admin, $this->role($organisation, SeededRole::Administrator), MembershipStatus::Active, MembershipChannel::Invitation, $admin);
        self::em()->flush();

        $body = $this->as($admin)->invite($organisation, 'kemi@example.com', SeededRole::Owner);

        self::assertSame(ErrorCode::GrantNotHeld->type(), $body['type']);
    }

    #[Test]
    public function anAdministratorHoldingEveryPermissionStillCannotInviteAnOwner(): void
    {
        [$organisation] = $this->organisation();
        $administrator = $this->role($organisation, SeededRole::Administrator);
        $administrator->setPermissions(Permission::cases());
        $admin = self::inviter('admin@ire.events', 'Bisi Adeyemi');
        self::service(MembershipMachine::class)->join($organisation, $admin, $administrator, MembershipStatus::Active, MembershipChannel::Invitation, $admin);
        self::em()->flush();

        $body = $this->as($admin)->invite($organisation, 'kemi@example.com', SeededRole::Owner);

        self::assertSame(ErrorCode::GrantNotHeld->type(), $body['type']);
        self::assertSame([], self::em()->getRepository(Invitation::class)->findBy(['email' => 'kemi@example.com']));
    }

    #[Test]
    public function aRoleFromAnotherOrganisationIsNotOneToInviteTo(): void
    {
        [$organisation, $owner] = $this->organisation();
        $elsewhere = self::organisationFor(self::inviter('tunde@elsewhere.events', 'Tunde Bello'), 'Elsewhere');

        $body = $this->as($owner)->call('POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/members/invite', [
            'email' => 'kemi@example.com',
            'roleId' => $this->role($elsewhere, SeededRole::Coordinator)->getId()->toRfc4122(),
        ]);

        self::assertSame(422, $this->statusCode());
        self::assertSame('roleId', Type\shape(['violations' => Type\vec(Type\shape(['propertyPath' => Type\string()], true))], true)->coerce($body)['violations'][0]['propertyPath']);
    }

    #[Test]
    public function anUnverifiedAddressOnAMembersAccountDoesNotMakeThatAddressAMember(): void
    {
        [$organisation, $owner] = $this->organisation();
        self::em()->persist(new EmailAddress($owner, 'new-hire@ire.events'));
        self::em()->flush();

        $this->as($owner)->invite($organisation, 'new-hire@ire.events', SeededRole::Coordinator);

        self::assertSame(201, $this->statusCode());
    }

    #[Test]
    public function theLinksTokenIsNeverPartOfTheAddress(): void
    {
        [, $token] = self::invitationTo('kemi@example.com');

        $this->call('GET', '/api/invitations/link/' . $token);

        self::assertSame(404, $this->statusCode());
    }

    #[Test]
    public function anActiveMembersAddressIsAlreadyAMember(): void
    {
        [$organisation, $owner] = $this->organisation();

        $body = $this->as($owner)->invite($organisation, $owner->getPrimaryEmailAddress()?->getAddress() ?? '', SeededRole::Coordinator);

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::AlreadyAMember->type(), $body['type']);
    }

    /** @return iterable<string, array{string, string}> */
    public static function badAddresses(): iterable
    {
        yield 'blank' => ['  ', 'Enter their email address.'];
        yield 'no domain' => ['kemi@', 'That does not look like an email address. Check it has an @ and a domain.'];
    }

    #[Test]
    #[DataProvider('badAddresses')]
    public function theAddressIsRequiredAndInAnEmailShape(string $email, string $message): void
    {
        [$organisation, $owner] = $this->organisation();

        $body = $this->as($owner)->invite($organisation, $email, SeededRole::Coordinator);

        self::assertSame(422, $this->statusCode());
        self::assertSame($message, Type\vec(Type\shape(['message' => Type\string()], true))->coerce($body['violations'])[0]['message']);
    }

    #[Test]
    public function aStrangerIsWrittenToInTheOrganisationsLanguage(): void
    {
        [$organisation, $owner] = $this->organisation();
        $this->as($owner)->call('PATCH', '/api/orgs/' . $organisation->getId()->toRfc4122(), ['locale' => 'fr']);
        self::assertSame(200, $this->statusCode());

        $this->invite($organisation, 'kemi@example.com', SeededRole::Coordinator);

        self::assertStringContainsString('Coordinateur', $this->lastText(), 'the role in French');
    }

    /** #3357: an abbreviated month carries its own stop, so the expiry line writes it in full. */
    #[Test]
    public function theExpiryLineWritesTheMonthInFull(): void
    {
        [$organisation, $owner] = $this->organisation();
        $this->as($owner)->call('PATCH', '/api/orgs/' . $organisation->getId()->toRfc4122(), ['locale' => 'fr']);

        $this->invite($organisation, 'kemi@example.com', SeededRole::Coordinator);

        self::assertMatchesRegularExpression('/\\d{1,2} (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\\.$/mu', $this->lastText());
        self::assertStringNotContainsString('..', $this->lastText());
    }

    /** sc-6758: English in the house's British order, the day before the month. */
    #[Test]
    public function theEnglishExpiryLinePutsTheDayFirst(): void
    {
        [$organisation, $owner] = $this->organisation();

        $this->as($owner)->invite($organisation, 'kemi@example.com', SeededRole::Coordinator);

        self::assertMatchesRegularExpression('/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) \\d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December)\\.$/mu', $this->lastText());
    }

    /** sc-2914: a new language is for what is sent after it; nothing already sent goes out again. */
    #[Test]
    public function changingTheLanguageSendsNothingAgain(): void
    {
        [$organisation, $owner] = $this->organisation();
        $this->as($owner)->invite($organisation, 'kemi@example.com', SeededRole::Coordinator);
        self::assertNotEmpty(self::getMailerMessages(), 'the invitation went out with its request');

        $this->call('PATCH', '/api/orgs/' . $organisation->getId()->toRfc4122(), ['locale' => 'pt']);

        self::assertSame(200, $this->statusCode());
        self::assertSame([], self::getMailerMessages(), 'the save sends nothing');
    }

    #[Test]
    public function onlySomebodyWithAnAccountIsToldTheyCanAcceptInTheProduct(): void
    {
        [$organisation, $owner] = $this->organisation();
        self::inviter('kemi@example.com', 'Kemi Lawal');

        $this->as($owner)->invite($organisation, 'amara@example.com', SeededRole::Coordinator);
        self::assertStringNotContainsString('accept it in Soirely', $this->lastText());
        $this->invite($organisation, 'kemi@example.com', SeededRole::Coordinator);
        self::assertStringContainsString('accept it in Soirely, signed in as kemi@example.com', $this->lastText());
    }

    #[Test]
    public function somebodyWithAnAccountIsWrittenToInTheirsAndCanAcceptInTheProduct(): void
    {
        [$organisation, $owner] = $this->organisation();
        $kemi = self::inviter('kemi@example.com', 'Kemi Lawal');
        $kemi->setLocale('pt');
        self::em()->flush();

        $this->as($owner)->invite($organisation, 'kemi@example.com', SeededRole::Coordinator);
        self::assertStringContainsString('Coordenador', $this->lastText(), 'the role in Portuguese');

        $waiting = Type\vec(Type\shape(['id' => Type\string(), 'forYou' => Type\bool()], true))->coerce($this->as($kemi)->call('GET', '/api/invitations')['invitations']);
        self::assertCount(1, $waiting);
        self::assertTrue($waiting[0]['forYou']);
        $this->call('POST', '/api/invitations/' . $waiting[0]['id'] . '/accept');
        self::assertSame(200, $this->statusCode());
    }

    #[Test]
    public function theDeliveryIsRecordedForSupport(): void
    {
        [$organisation, $owner] = $this->organisation();

        $this->as($owner)->invite($organisation, 'kemi@example.com', SeededRole::Coordinator);

        $invitation = Type\instance_of(Invitation::class)->coerce(self::em()->getRepository(Invitation::class)->findOneBy(['email' => 'kemi@example.com']));
        self::em()->refresh($invitation);
        self::assertSame(InvitationDelivery::Sent, $invitation->getDelivery());
        self::assertNotNull($invitation->getSentAt());
    }

    #[Test]
    public function aRevokedInvitationsLinkIsUseless(): void
    {
        [$organisation, $owner] = $this->organisation();
        $this->as($owner)->invite($organisation, 'kemi@example.com', SeededRole::Coordinator);
        $token = $this->linkToken();
        $invitation = Type\instance_of(Invitation::class)->coerce(self::em()->getRepository(Invitation::class)->findOneBy(['email' => 'kemi@example.com']));

        $this->call('DELETE', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/invitations/' . $invitation->getId()->toRfc4122());
        self::assertSame(200, $this->statusCode());

        self::assertSame('invitation_revoked', $this->call('POST', '/api/invitations/link', ['token' => $token])['refusal']);
        $this->register('kemi@example.com', $token);
        self::assertSame(410, $this->statusCode());
        $this->assertNoAccount('kemi@example.com');
    }

    #[Test]
    public function theMembersListShowsEveryStateItsHistoryAndTheInvitations(): void
    {
        [$organisation, $owner] = $this->organisation();
        $kemi = self::inviter('kemi@example.com', 'Kemi Lawal');
        $membership = self::service(MembershipMachine::class)->join($organisation, $kemi, $this->role($organisation, SeededRole::Coordinator), MembershipStatus::Active, MembershipChannel::JoinCode, $kemi);
        self::service(MembershipMachine::class)->move($membership, MembershipStatus::LeftOrRemoved, MembershipChannel::JoinCode, $owner);
        self::em()->flush();
        $this->as($owner)->invite($organisation, 'amara@example.com', SeededRole::ReadOnly);

        $body = $this->call('GET', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/members');

        self::assertSame(200, $this->statusCode());
        $members = Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($body['members']);
        $former = Iter\first(Vec\filter($members, static fn (array $member): bool => 'left_or_removed' === $member['status']));
        self::assertNotNull($former);
        self::assertSame('removed', $former['former'], 'somebody else caused it');
        self::assertSame('join_code', $former['channel']);
        self::assertCount(2, Type\vec(Type\mixed())->coerce($former['history']));
        $invitations = Type\vec(Type\shape(['email' => Type\string(), 'status' => Type\string()], true))->coerce($body['invitations']);
        self::assertSame([['amara@example.com', 'pending']], Vec\map($invitations, static fn (array $invitation): array => [$invitation['email'], $invitation['status']]));
        self::assertStringNotContainsString('delivery', Json\encode($body), 'delivery is support\'s');
    }

    /** @return array{Organisation, User} */
    private function organisation(): array
    {
        $owner = self::inviter('folake@ire.events', 'Folake Adeyemi');

        return [self::organisationFor($owner), $owner];
    }

    /** @return array<string, mixed> */
    private function invite(Organisation $organisation, string $email, SeededRole $as): array
    {
        return $this->call('POST', '/api/orgs/' . $organisation->getId()->toRfc4122() . '/members/invite', [
            'email' => $email,
            'roleId' => $this->role($organisation, $as)->getId()->toRfc4122(),
        ]);
    }

    /** @return array<string, mixed> */
    private function register(string $email, #[SensitiveParameter] string $token): array
    {
        return $this->call('POST', '/api/auth/register', [
            'email' => $email,
            'name' => 'Kemi Lawal',
            'password' => self::PASSWORD,
            'invitationToken' => $token,
        ]);
    }

    private function path(Invitation $invitation, string $answer): string
    {
        return '/api/invitations/' . $invitation->getId()->toRfc4122() . '/' . $answer;
    }

    private function as(User $user): self
    {
        self::em()->flush();
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($user));

        return $this;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function call(string $method, string $path, ?array $body = null): array
    {
        $this->client->request($method, $path, server: ['CONTENT_TYPE' => 'application/json'], content: null === $body ? null : Json\encode($body));
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }

    private function linkToken(): string
    {
        return Regex\first_match($this->lastText(), '/\/join\/([0-9a-f]{64})/')[1] ?? '';
    }

    private function lastText(): string
    {
        return Type\string()->coerce(Type\instance_of(Email::class)->coerce(Iter\last(self::getMailerMessages()))->getTextBody());
    }

    private function assertNoAccount(string $address): void
    {
        self::em()->clear();
        self::assertNull(self::service(EmailAddressRepository::class)->findOneByAddress($address), "an account exists for {$address}");
    }

    private function accountAt(string $address): User
    {
        self::em()->clear();

        return Type\instance_of(User::class)->coerce(self::service(EmailAddressRepository::class)->findOneByAddress($address)?->getUser());
    }

    private function membershipOf(User $user, Invitation $invitation): ?Membership
    {
        self::em()->clear();

        return self::em()->getRepository(Membership::class)->findOneBy(['user' => $user->getId(), 'organisation' => $invitation->getOrganisation()?->getId()]);
    }

    private function memberships(Invitation $invitation): int
    {
        return Iter\count(self::em()->getRepository(Membership::class)->findBy(['organisation' => $invitation->getOrganisation()?->getId()]));
    }

    private function reloaded(Invitation $invitation): Invitation
    {
        self::em()->clear();

        return Type\instance_of(Invitation::class)->coerce(self::em()->find(Invitation::class, $invitation->getId()));
    }

    private function role(Organisation $organisation, SeededRole $seeded): Role
    {
        return Type\instance_of(Role::class)->coerce(self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation->getId(), 'seededAs' => $seeded]));
    }
}
