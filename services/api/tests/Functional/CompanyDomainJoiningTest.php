<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\DomainJoining\JoinOfferFinder;
use App\Domain\Organisation\DomainJoining\JoinRequester;
use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\EmailAddress;
use App\Entity\Membership;
use App\Entity\MembershipTransition;
use App\Entity\Organisation;
use App\Entity\OrganisationDomain;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Repository\JoinOfferDismissalRepository;
use App\Repository\MembershipRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

final class CompanyDomainJoiningTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function somebodyWhoManagesMembersAddsTheDomainTheirOwnAddressIsAt(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->signIn($owner);

        $body = $this->send('POST', $this->domains($organisation), ['domain' => '  IRE.events ']);

        self::assertResponseStatusCodeSame(201);
        self::assertSame([['domain' => 'ire.events', 'stopped' => false]], $body['domains']);
        self::assertSame('folake@ire.events', $body['ownAddress']);
        self::assertSame(5, $body['most']);
        self::assertSame(['domain' => [null, 'ire.events']], $this->audited('organisation_domain.added', $organisation)->changes());
    }

    #[Test]
    public function aDomainTheirAddressIsNotAtIsRefused(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->signIn($owner);

        $body = $this->send('POST', $this->domains($organisation), ['domain' => 'okafor.family']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame([['domain', 'Add a domain your own address is at.']], $this->violations($body));
    }

    #[Test]
    public function aPublicMailDomainIsRefusedEvenForSomebodyWhoseAddressIsThere(): void
    {
        [$owner, $organisation] = $this->organisation('folake@gmail.com', 'Ìrè Events');
        $this->signIn($owner);

        $body = $this->send('POST', $this->domains($organisation), ['domain' => 'gmail.com']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame([['domain', 'You cannot use a public email domain.']], $this->violations($body));
    }

    /** @return iterable<string, array{string, string}> */
    public static function formChecks(): iterable
    {
        yield 'blank' => ['   ', 'Enter a domain, like ire.events.'];
        yield 'no dot' => ['ireevents', 'Enter a domain with a dot and no spaces, like ire.events.'];
        yield 'a space' => ['ire events.com', 'Enter a domain with a dot and no spaces, like ire.events.'];
    }

    #[Test]
    #[DataProvider('formChecks')]
    public function aDomainIsRequiredAndMustBeAHostnameWithADot(string $typed, string $message): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->signIn($owner);

        $body = $this->send('POST', $this->domains($organisation), ['domain' => $typed]);

        self::assertResponseStatusCodeSame(422);
        self::assertSame([['domain', $message]], $this->violations($body));
    }

    #[Test]
    public function theListHoldsFiveDomains(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        foreach (['ire.ng', 'ire-catering.com', 'ireweddings.com', 'ireevents.com', 'ire.co'] as $domain) {
            self::service(EntityManagerInterface::class)->persist(new OrganisationDomain($organisation, $domain));
        }
        $this->signIn($owner);

        $body = $this->send('POST', $this->domains($organisation), ['domain' => 'ire.events']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame([['domain', 'That is 5 domains, the most the list can hold. Remove one to add another.']], $this->violations($body));
    }

    #[Test]
    public function removingADomainTakesItOffTheListAndIsAudited(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $this->signIn($owner);

        $body = $this->send('DELETE', $this->domains($organisation) . '/ire.events');

        self::assertResponseStatusCodeSame(200);
        self::assertSame([], $body['domains']);
        self::assertSame(['domain' => ['ire.events', null]], $this->audited('organisation_domain.removed', $organisation)->changes());
    }

    #[Test]
    public function aRoleThatCannotManageMembersCannotSeeOrChangeTheList(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $coordinator = $this->member($organisation, 'tunde@ire.events', SeededRole::Coordinator);
        $this->signIn($coordinator);

        $this->send('GET', $this->domains($organisation));
        self::assertResponseStatusCodeSame(403);

        $this->send('POST', $this->domains($organisation), ['domain' => 'ire.events']);
        self::assertResponseStatusCodeSame(403);
    }

    #[Test]
    public function aNewcomerAtAListedDomainIsOfferedItBeforeTheirDetailsAreSaved(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $this->signIn($this->newcomer('ada@ire.events'));

        $body = $this->send('GET', '/api/join-offers');

        self::assertResponseStatusCodeSame(200);
        self::assertSame('ire.events', $body['domain']);
        self::assertSame([['id' => $organisation->getId()->toRfc4122(), 'name' => 'Ìrè Events']], $body['offers']);
        self::assertNull($body['request']);
    }

    #[Test]
    public function aNewcomerAtNoListedDomainIsOfferedNothing(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $this->signIn($this->newcomer('ada@okafor.family'));

        self::assertSame([], $this->send('GET', '/api/join-offers')['offers']);
    }

    #[Test]
    public function everyOrganisationListingTheDomainIsOffered(): void
    {
        [, $events] = $this->organisation('folake@ire.events', 'Ìrè Events');
        [, $kitchen] = $this->organisation('bisi@ire.events', 'Ìrè Events Kitchen');
        $this->list($events, 'ire.events');
        $this->list($kitchen, 'ire.events');
        $this->signIn($this->newcomer('ada@ire.events'));

        self::assertSame(['Ìrè Events', 'Ìrè Events Kitchen'], Vec\map($this->offers(), static fn (array $offer): mixed => $offer['name']));
    }

    #[Test]
    public function anOrganisationThatProvedTheDomainIsTheOnlyOneOffered(): void
    {
        [, $events] = $this->organisation('folake@ire.events', 'Ìrè Events');
        [$kitchenOwner, $kitchen] = $this->organisation('bisi@ire.events', 'Ìrè Events Kitchen');
        $this->list($events, 'ire.events')->setProvedAt(new DateTimeImmutable());
        $this->list($kitchen, 'ire.events');
        $this->signIn($this->newcomer('ada@ire.events'));

        self::assertSame(['Ìrè Events'], Vec\map($this->offers(), static fn (array $offer): mixed => $offer['name']));

        $this->signIn($kitchenOwner);
        self::assertSame([['domain' => 'ire.events', 'stopped' => true]], $this->send('GET', $this->domains($kitchen))['domains']);
    }

    #[Test]
    public function aDomainAnotherOrganisationProvedCannotBeAdded(): void
    {
        [, $events] = $this->organisation('folake@ire.events', 'Ìrè Events');
        [$kitchenOwner, $kitchen] = $this->organisation('bisi@ire.events', 'Ìrè Events Kitchen');
        $this->list($events, 'ire.events')->setProvedAt(new DateTimeImmutable());
        $this->signIn($kitchenOwner);

        $body = $this->send('POST', $this->domains($kitchen), ['domain' => 'ire.events']);

        self::assertResponseStatusCodeSame(422);
        self::assertSame([['domain', 'Another organisation has proved ire.events on Enterprise, so only its listing works.']], $this->violations($body));
    }

    #[Test]
    public function anAlternativeAddressAtTheDomainNeverMatches(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $newcomer = $this->newcomer('ada@okafor.family');
        new EmailAddress($newcomer, 'ada@ire.events')->setVerifiedAt(new DateTimeImmutable());
        $this->signIn($newcomer);

        self::assertSame([], $this->offers());
    }

    #[Test]
    public function anUnverifiedPrimaryAddressNeverMatches(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $newcomer = self::service(UserRegistrar::class)->register('ada@ire.events', 'Ada Okeke', self::PASSWORD)->user;
        self::service(EntityManagerInterface::class)->flush();

        self::assertSame([], self::service(JoinOfferFinder::class)->offersFor($newcomer));
    }

    #[Test]
    public function aGoogleSignUpAtTheDomainIsOfferedItToo(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $google = self::service(UserRegistrar::class)->registerFromProvider('ada@ire.events', 'Ada Okeke')->user;
        $this->signIn($google);

        self::assertSame(['Ìrè Events'], Vec\map($this->offers(), static fn (array $offer): mixed => $offer['name']));
    }

    #[Test]
    public function askingFromTheDetailsScreenSavesTheDetailsAndWaitsForApproval(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $newcomer = $this->newcomer('ada@ire.events');
        $this->signIn($newcomer);

        $body = $this->send('PATCH', '/api/auth/complete-profile', ['name' => 'Ada Okeke', 'askToJoin' => $organisation->getId()->toRfc4122()]);

        self::assertResponseStatusCodeSame(200);
        $account = Type\dict(Type\string(), Type\mixed())->coerce($body['account']);
        self::assertTrue($account['complete'], 'the details are saved');
        self::assertSame(
            ['id' => $organisation->getId()->toRfc4122(), 'name' => 'Ìrè Events'],
            Type\shape(['organisation' => Type\mixed()], true)->coerce($account['waitingFor'])['organisation'],
        );
        $membership = $this->membershipOf($newcomer, $organisation);
        self::assertSame(MembershipStatus::PendingApproval, $membership->getStatus());
        self::assertSame(SeededRole::ReadOnly, $membership->getRole()->getSeededAs(), 'least privilege until somebody chooses');
        self::assertSame(MembershipChannel::Domain, $this->lastStep($membership)->getChannel());
        self::assertSame(['organisation' => [null, $organisation->getId()->toRfc4122()]], $this->audited('domain_join.asked', $membership)->changes());
    }

    #[Test]
    public function askingRunsTheSameChecksAsSaveAndWritesNothingWhenOneFails(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $newcomer = $this->newcomer('ada@ire.events');
        $this->signIn($newcomer);

        $body = $this->send('PATCH', '/api/auth/complete-profile', ['name' => '  ', 'askToJoin' => $organisation->getId()->toRfc4122()]);

        self::assertResponseStatusCodeSame(422);
        self::assertSame(['name'], Vec\map($this->violations($body), static fn (array $violation): string => $violation[0]));
        self::assertNull(self::service(MembershipRepository::class)->findOneBy(['user' => $newcomer]));
    }

    #[Test]
    public function anOrganisationNotOfferedCannotBeAskedFromTheDetailsScreen(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->signIn($this->newcomer('ada@ire.events'));

        $body = $this->send('PATCH', '/api/auth/complete-profile', ['name' => 'Ada Okeke', 'askToJoin' => $organisation->getId()->toRfc4122()]);

        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::JoinOfferUnavailable->type(), $body['type']);
    }

    #[Test]
    public function whileOneRequestWaitsTheOtherListingOrganisationsAreNotOffered(): void
    {
        [, $events] = $this->organisation('folake@ire.events', 'Ìrè Events');
        [, $kitchen] = $this->organisation('bisi@ire.events', 'Ìrè Events Kitchen');
        $this->list($events, 'ire.events');
        $this->list($kitchen, 'ire.events');
        $newcomer = $this->newcomer('ada@ire.events');
        $this->signIn($newcomer);
        $this->send('PATCH', '/api/auth/complete-profile', ['name' => 'Ada Okeke', 'askToJoin' => $events->getId()->toRfc4122()]);

        $body = $this->send('GET', '/api/join-offers');

        self::assertSame([], $body['offers']);
        self::assertSame('Ìrè Events', Type\shape(['organisation' => Type\shape(['name' => Type\string()], true)], true)->coerce($body['request'])['organisation']['name']);

        $this->send('POST', Str\format('/api/join-offers/%s/ask', $kitchen->getId()->toRfc4122()));
        self::assertResponseStatusCodeSame(409);
    }

    #[Test]
    public function startingYourOwnInsteadWithdrawsTheRequestAndOffersTheRestAgain(): void
    {
        [, $events] = $this->organisation('folake@ire.events', 'Ìrè Events');
        [, $kitchen] = $this->organisation('bisi@ire.events', 'Ìrè Events Kitchen');
        $this->list($events, 'ire.events');
        $this->list($kitchen, 'ire.events');
        $newcomer = $this->newcomer('ada@ire.events');
        $this->signIn($newcomer);
        $this->send('PATCH', '/api/auth/complete-profile', ['name' => 'Ada Okeke', 'askToJoin' => $events->getId()->toRfc4122()]);

        $this->send('DELETE', '/api/join-offers/request');

        self::assertResponseStatusCodeSame(204);
        $membership = $this->membershipOf($newcomer, $events);
        self::assertSame(MembershipStatus::LeftOrRemoved, $membership->getStatus());
        self::assertSame(['status' => ['pending_approval', 'left_or_removed']], $this->audited('domain_join.withdrawn', $membership)->changes());
        self::assertNull(Type\dict(Type\string(), Type\mixed())->coerce($this->send('GET', '/api/auth/me'))['waitingFor']);
        self::assertSame(['Ìrè Events', 'Ìrè Events Kitchen'], Vec\map($this->offers(), static fn (array $offer): mixed => $offer['name']), 'withdrawing is not being turned down');

        $this->send('POST', '/api/orgs', ['name' => 'Ada Events', 'countryCode' => 'NG', 'timezone' => 'Africa/Lagos']);
        self::assertResponseStatusCodeSame(201);
    }

    #[Test]
    public function aRequestTurnedDownKeepsThatOrganisationFromBeingOfferedForThirtyDays(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $newcomer = $this->newcomer('ada@ire.events');
        $membership = self::service(JoinRequester::class)->ask($newcomer, $organisation);
        $this->turnDown($membership, $owner, new DateTimeImmutable('-719 hours'));
        $this->signIn($newcomer);

        self::assertSame([], $this->offers());
    }

    #[Test]
    public function aRequestTurnedDownThirtyDaysAgoIsOfferedAgain(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $newcomer = $this->newcomer('ada@ire.events');
        $membership = self::service(JoinRequester::class)->ask($newcomer, $organisation);
        $this->turnDown($membership, $owner, new DateTimeImmutable('-721 hours'));
        $this->signIn($newcomer);

        self::assertSame(['Ìrè Events'], Vec\map($this->offers(), static fn (array $offer): mixed => $offer['name']));

        $this->send('PATCH', '/api/auth/complete-profile', ['name' => 'Ada Okeke', 'askToJoin' => $organisation->getId()->toRfc4122()]);
        self::assertResponseStatusCodeSame(200, 'the row left behind waits again');
        self::assertSame(MembershipStatus::PendingApproval, $this->membershipOf($newcomer, $organisation)->getStatus());
    }

    #[Test]
    public function aRequestThatExpiredCountsAsTurnedDown(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $newcomer = $this->newcomer('ada@ire.events');
        $membership = self::service(JoinRequester::class)->ask($newcomer, $organisation);
        $this->turnDown($membership, null, new DateTimeImmutable('-1 hour'));
        $this->signIn($newcomer);

        self::assertSame([], $this->offers());
    }

    #[Test]
    public function aMemberIsOfferedAnotherListingOrganisationInTheSwitcherUntilTheySayNotNow(): void
    {
        [, $kitchen] = $this->organisation('bisi@ire.events', 'Ìrè Events Kitchen');
        [$folake, $events] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($events, 'ire.events');
        $this->list($kitchen, 'ire.events');
        $this->signIn($folake);

        self::assertSame(['Ìrè Events Kitchen'], Vec\map($this->offers(), static fn (array $offer): mixed => $offer['name']), 'not the one they are in');

        $this->send('POST', Str\format('/api/join-offers/%s/dismiss', $kitchen->getId()->toRfc4122()));
        self::assertResponseStatusCodeSame(204);
        self::assertSame([], $this->offers());
    }

    #[Test]
    public function anOrganisationNotOfferedCannotBeDismissed(): void
    {
        [, $kitchen] = $this->organisation('bisi@okafor.family', 'Okafor Kitchen');
        [$folake] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->signIn($folake);

        $body = $this->send('POST', Str\format('/api/join-offers/%s/dismiss', $kitchen->getId()->toRfc4122()));

        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::JoinOfferUnavailable->type(), $body['type']);
        self::assertSame([], self::service(JoinOfferDismissalRepository::class)->findOrganisationIdsDismissedBy($folake));
    }

    #[Test]
    public function aMemberAsksFromTheSwitcherAndKeepsTheOrganisationsTheyAreIn(): void
    {
        [, $kitchen] = $this->organisation('bisi@ire.events', 'Ìrè Events Kitchen');
        [$folake, $events] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($kitchen, 'ire.events');
        $this->signIn($folake);

        $body = $this->send('POST', Str\format('/api/join-offers/%s/ask', $kitchen->getId()->toRfc4122()));

        self::assertResponseStatusCodeSame(201);
        self::assertSame('Ìrè Events Kitchen', Type\shape(['organisation' => Type\shape(['name' => Type\string()], true)], true)->coerce($body['request'])['organisation']['name']);
        self::assertNull(Type\dict(Type\string(), Type\mixed())->coerce($this->send('GET', '/api/auth/me'))['waitingFor'], 'only an account in none waits on the details screen');
        self::assertNotNull(self::service(MembershipRepository::class)->findActive($folake, $events->getId()));
    }

    #[Test]
    public function somebodyWaitingIsShownOnlyToThoseWhoDecideOnThem(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->list($organisation, 'ire.events');
        $reader = $this->member($organisation, 'tunde@ire.events', SeededRole::Coordinator);
        $role = Type\instance_of(Role::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => SeededRole::Coordinator]),
        );
        $role->setPermissions([...$role->getPermissions(), Permission::MembersRead]);
        self::service(JoinRequester::class)->ask($this->newcomer('ada@okafor.family', 'ada@ire.events'), $organisation);

        $this->signIn($reader);
        self::assertNotContains('pending_approval', $this->statuses($organisation), 'a reader who cannot decide');

        $this->signIn($owner);
        self::assertContains('pending_approval', $this->statuses($organisation));
    }

    #[Test]
    public function aNewcomerWithNoMatchingDomainStillFoundsTheirOwnFromTheDetailsScreen(): void
    {
        $newcomer = $this->newcomer('ada@okafor.family');
        $this->signIn($newcomer);

        $this->send('PATCH', '/api/auth/complete-profile', ['name' => 'Ada Okeke', 'organisationName' => 'Okafor Family', 'countryCode' => 'NG', 'timezone' => 'Africa/Lagos']);

        self::assertResponseStatusCodeSame(200);
        self::assertCount(1, self::service(MembershipRepository::class)->findActiveFor($newcomer));
    }

    /** @return array{User, Organisation} an owner through the gate, and the organisation they founded */
    private function organisation(string $ownerAddress, string $name): array
    {
        $owner = self::service(UserRegistrar::class)->register($ownerAddress, 'Owner', self::PASSWORD)->user;
        self::onboard($owner, withOrganisation: false);
        $organisation = self::service(OrganisationFounder::class)->found($owner, $name, 'NG', 'Africa/Lagos');
        self::service(EntityManagerInterface::class)->flush();

        return [$owner, $organisation];
    }

    private function member(Organisation $organisation, string $address, SeededRole $as): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Member', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);
        $role = Type\instance_of(Role::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => $as]),
        );
        self::service(MembershipMachine::class)->join($organisation, $user, $role, MembershipStatus::Active, MembershipChannel::Invitation, $user);
        self::service(EntityManagerInterface::class)->flush();

        return $user;
    }

    /** Verified and self-registered, with "A few details" still to save; a second address makes the first one alternative. */
    private function newcomer(string $primary, ?string $instead = null): User
    {
        $user = self::service(UserRegistrar::class)->register($primary, 'Ada Okeke', self::PASSWORD)->user;
        $user->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());

        if (null !== $instead) {
            $user->getPrimaryEmailAddress()?->setPrimary(false);
            self::service(EntityManagerInterface::class)->flush();
            new EmailAddress($user, Type\non_empty_string()->assert($instead), isPrimary: true)->setVerifiedAt(new DateTimeImmutable());
        }

        self::service(EntityManagerInterface::class)->flush();

        return $user;
    }

    private function list(Organisation $organisation, string $domain): OrganisationDomain
    {
        $listing = new OrganisationDomain($organisation, $domain);
        self::service(EntityManagerInterface::class)->persist($listing);
        self::service(EntityManagerInterface::class)->flush();

        return $listing;
    }

    /** As sc-392 will: by somebody who decides, or by nobody when the request expires, at the moment given. */
    private function turnDown(Membership $membership, ?User $by, DateTimeImmutable $at): void
    {
        $membership->setStatus(MembershipStatus::LeftOrRemoved, $at);
        self::service(EntityManagerInterface::class)->persist(
            new MembershipTransition($membership, MembershipStatus::PendingApproval, MembershipStatus::LeftOrRemoved, MembershipChannel::Settings, $by, $at),
        );
        self::service(EntityManagerInterface::class)->flush();
    }

    private function membershipOf(User $user, Organisation $organisation): Membership
    {
        $membership = self::service(MembershipRepository::class)->findOneBy(['user' => $user, 'organisation' => $organisation]);
        self::assertNotNull($membership);
        self::service(EntityManagerInterface::class)->refresh($membership);

        return $membership;
    }

    private function lastStep(Membership $membership): MembershipTransition
    {
        return Type\instance_of(MembershipTransition::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(MembershipTransition::class)->findOneBy(['membership' => $membership], ['occurredAt' => 'DESC', 'id' => 'DESC']),
        );
    }

    private function audited(string $action, Organisation|Membership $subject): AuditEntry
    {
        return Type\instance_of(AuditEntry::class)->coerce(
            self::service(EntityManagerInterface::class)->getRepository(AuditEntry::class)->findOneBy(['action' => $action, 'subjectId' => $subject->getId()]),
        );
    }

    private function domains(Organisation $organisation): string
    {
        return Str\format('/api/orgs/%s/domains', $organisation->getId()->toRfc4122());
    }

    /** @return list<array<string, mixed>> */
    private function offers(): array
    {
        return Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->send('GET', '/api/join-offers')['offers']);
    }

    /** @return list<string> */
    private function statuses(Organisation $organisation): array
    {
        $body = $this->send('GET', Str\format('/api/orgs/%s/members', $organisation->getId()->toRfc4122()));
        self::assertResponseStatusCodeSame(200);

        return Vec\map(
            Type\vec(Type\shape(['status' => Type\string()], true))->coerce($body['members']),
            static fn (array $member): string => $member['status'],
        );
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return list<array{string, string}>
     */
    private function violations(array $body): array
    {
        return Vec\map(
            Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($body['violations']),
            static fn (array $violation): array => [$violation['propertyPath'], $violation['message']],
        );
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
