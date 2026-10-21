<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Organisation\RequestLink\LinkRequester;
use App\Domain\User\UserRegistrar;
use App\Entity\AuditEntry;
use App\Entity\Membership;
use App\Entity\MembershipTransition;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Http\Exception\ApiException;
use App\Repository\MembershipRepository;
use App\Tests\ApiTestCase;
use App\Tests\Double\RefusingRateLimiterFactory;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\SecureRandom;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

final class RequestLinkTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function theLinkIsOffUntilSomebodyWhoManagesMembersTurnsItOn(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->signIn($owner);

        self::assertSame(['on' => false, 'url' => null], $this->send('GET', $this->setting($organisation)));

        $body = $this->send('PUT', $this->setting($organisation));

        self::assertResponseStatusCodeSame(200);
        self::assertTrue($body['on']);
        self::assertMatchesRegularExpression('~^https?://[^/]+/join/[0-9a-f]{32}$~', Type\string()->coerce($body['url']));
        self::assertSame(['requestLink' => ['off', 'on']], $this->audited('request_link.turned_on', $organisation)->changes());
    }

    #[Test]
    public function turningItOnAgainKeepsTheLinkThatIsOn(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->signIn($owner);
        $first = $this->send('PUT', $this->setting($organisation));

        self::assertSame($first, $this->send('PUT', $this->setting($organisation)));
    }

    #[Test]
    public function replacingTheLinkStopsTheOldOne(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->signIn($owner);
        $old = $this->tokenOf($this->send('PUT', $this->setting($organisation)));

        $new = $this->tokenOf($this->send('POST', $this->setting($organisation) . '/replace'));

        self::assertNotSame($old, $new);
        self::assertSame(['requestLink' => ['on', 'on']], $this->audited('request_link.replaced', $organisation)->changes());
        $this->send('POST', '/api/request-links/link', ['token' => $old]);
        self::assertResponseStatusCodeSame(404);
        self::assertSame('Ìrè Events', $this->send('POST', '/api/request-links/link', ['token' => $new])['organisation']['name'] ?? null);
    }

    #[Test]
    public function turningItOffAndOnAgainGivesANewLinkAndTheOldOneNeverWorksAgain(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->signIn($owner);
        $old = $this->tokenOf($this->send('PUT', $this->setting($organisation)));

        self::assertSame(['on' => false, 'url' => null], $this->send('DELETE', $this->setting($organisation)));
        self::assertSame(['requestLink' => ['on', 'off']], $this->audited('request_link.turned_off', $organisation)->changes());
        $new = $this->tokenOf($this->send('PUT', $this->setting($organisation)));

        self::assertNotSame($old, $new);
        $this->send('POST', '/api/request-links/link', ['token' => $old]);
        self::assertResponseStatusCodeSame(404);
    }

    #[Test]
    public function aRoleThatCannotManageMembersCannotSeeOrChangeTheLink(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $coordinator = $this->member($organisation, 'tunde@ire.events', SeededRole::Coordinator);
        $this->signIn($coordinator);

        foreach ([['GET', ''], ['PUT', ''], ['DELETE', ''], ['POST', '/replace']] as [$method, $path]) {
            $this->send($method, $this->setting($organisation) . $path);
            self::assertResponseStatusCodeSame(403);
        }

        self::assertNull($organisation->getRequestLinkToken());
    }

    #[Test]
    public function aSwitchedOffLinkAndAnUnknownTokenGiveTheSameAnswer(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $this->signIn($owner);
        $off = $this->tokenOf($this->send('PUT', $this->setting($organisation)));
        $this->send('DELETE', $this->setting($organisation));

        $switchedOff = $this->send('POST', '/api/request-links/link', ['token' => $off]);
        $switchedOffStatus = $this->client->getResponse()->getStatusCode();
        $unknown = $this->send('POST', '/api/request-links/link', ['token' => Str\repeat('ab', 16)]);

        self::assertSame(404, $switchedOffStatus);
        self::assertResponseStatusCodeSame(404);
        self::assertSame(ErrorCode::RequestLinkDead->type(), $unknown['type'] ?? null);
        self::assertSame("This link doesn't work any more. Ask the organisation for a new one.", $unknown['detail'] ?? null);
        unset($switchedOff['correlationId'], $unknown['correlationId'], $switchedOff['instance'], $unknown['instance']);
        self::assertSame($unknown, $switchedOff);
    }

    #[Test]
    public function somebodySignedOutSeesOnlyTheOrganisationsName(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $token = $this->turnOn($organisation);

        $body = $this->send('POST', '/api/request-links/link', ['token' => $token]);

        self::assertResponseStatusCodeSame(200);
        self::assertSame(['organisation' => ['name' => 'Ìrè Events'], 'standing' => null, 'askAgainFrom' => null], $body);

        $this->send('POST', '/api/request-links/ask', ['token' => $token]);
        self::assertResponseStatusCodeSame(401);
    }

    #[Test]
    public function askingSignedInWaitsForApprovalAsAskedToJoinWithTheMessage(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $token = $this->turnOn($organisation);
        $ada = $this->member($this->organisation('ada@okeke.family', 'Okeke Family')[1], 'ada@gmail.com', SeededRole::Owner);
        $this->signIn($ada);

        $body = $this->send('POST', '/api/request-links/ask', ['token' => $token, 'message' => '  I run the Abuja office.  ']);

        self::assertResponseStatusCodeSame(201);
        self::assertSame('Ìrè Events', $body['request']['organisation']['name'] ?? null);
        $membership = $this->membershipOf($ada, $organisation);
        self::assertSame(MembershipStatus::PendingApproval, $membership->getStatus());
        self::assertSame(SeededRole::ReadOnly, $membership->getRole()->getSeededAs());
        self::assertSame('I run the Abuja office.', $membership->getRequestMessage());
        self::assertSame(MembershipChannel::Request, $this->lastStep($membership)->getChannel());
        self::assertSame(['organisation' => [null, $organisation->getId()->toRfc4122()], 'status' => [null, 'pending_approval']], $this->audited(LinkRequester::ASKED, $membership)->changes());

        $this->signIn($owner);
        $members = Type\vec(Type\shape(['status' => Type\string(), 'channel' => Type\nullable(Type\string()), 'message' => Type\nullable(Type\string())], true))
            ->coerce($this->send('GET', Str\format('/api/orgs/%s/members', $organisation->getId()->toRfc4122()))['members']);
        $waiting = Vec\filter($members, static fn (array $member): bool => 'pending_approval' === $member['status']);
        self::assertSame([['request', 'I run the Abuja office.']], Vec\map($waiting, static fn (array $member): array => [$member['channel'], $member['message']]));
    }

    #[Test]
    public function somebodyWhoRegisteredFromTheLinkAsksBeforeTheyHaveAnOrganisation(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $token = $this->turnOn($organisation);
        $newcomer = self::service(UserRegistrar::class)->register('kemi.l@gmail.com', 'Kemi Lawal', self::PASSWORD)->user;
        $newcomer->getPrimaryEmailAddress()?->setVerifiedAt(new DateTimeImmutable());
        $this->signIn($newcomer);

        $link = $this->send('POST', '/api/request-links/link', ['token' => $token]);
        self::assertArrayHasKey('standing', $link);
        self::assertNull($link['standing']);
        $this->send('POST', '/api/request-links/ask', ['token' => $token]);

        self::assertResponseStatusCodeSame(201);
        self::assertNull($this->membershipOf($newcomer, $organisation)->getRequestMessage());
        self::assertSame('Ìrè Events', $this->send('GET', '/api/auth/me')['waitingFor']['organisation']['name'] ?? null);
    }

    #[Test]
    public function anAddressNobodyHasVerifiedCannotAsk(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $token = $this->turnOn($organisation);
        $this->signIn(self::service(UserRegistrar::class)->register('kemi.l@gmail.com', 'Kemi Lawal', self::PASSWORD)->user);

        $body = $this->send('POST', '/api/request-links/ask', ['token' => $token]);

        self::assertResponseStatusCodeSame(403);
        self::assertSame(ErrorCode::AccountUnverified->type(), $body['type'] ?? null);
    }

    #[Test]
    public function somebodyWhoAlreadyBelongsIsToldSoInsteadOfAskingAgain(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $token = $this->turnOn($organisation);
        $this->signIn($owner);

        self::assertSame('member', $this->send('POST', '/api/request-links/link', ['token' => $token])['standing'] ?? null);
        $body = $this->send('POST', '/api/request-links/ask', ['token' => $token]);

        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::AlreadyAMember->type(), $body['type'] ?? null);
    }

    #[Test]
    public function somebodyAlreadyWaitingIsToldSoInsteadOfASecondRequest(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $token = $this->turnOn($organisation);
        $ada = $this->outsider('ada@gmail.com');
        $this->signIn($ada);
        $this->send('POST', '/api/request-links/ask', ['token' => $token]);

        self::assertSame('waiting', $this->send('POST', '/api/request-links/link', ['token' => $token])['standing'] ?? null);
        $body = $this->send('POST', '/api/request-links/ask', ['token' => $token]);

        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::JoinRequestWaiting->type(), $body['type'] ?? null);
        self::assertCount(1, self::service(EntityManagerInterface::class)->getRepository(MembershipTransition::class)->findBy(['membership' => $this->membershipOf($ada, $organisation)]));
    }

    #[Test]
    public function somebodyTurnedDownWaitsThirtyDaysToAskTheSameOrganisationAgain(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $token = $this->turnOn($organisation);
        $ada = $this->outsider('ada@gmail.com');
        $this->signIn($ada);
        $this->send('POST', '/api/request-links/ask', ['token' => $token]);
        $turnedDownAt = new DateTimeImmutable('-29 days');
        $this->turnDown($this->membershipOf($ada, $organisation), $owner, $turnedDownAt);

        $link = $this->send('POST', '/api/request-links/link', ['token' => $token]);
        $body = $this->send('POST', '/api/request-links/ask', ['token' => $token]);

        self::assertSame('cooling_off', $link['standing'] ?? null);
        self::assertSame($turnedDownAt->modify('+30 days')->format(\DATE_ATOM), $link['askAgainFrom'] ?? null);
        self::assertResponseStatusCodeSame(409);
        self::assertSame(ErrorCode::JoinRequestCoolingOff->type(), $body['type'] ?? null);
        self::assertSame($link['askAgainFrom'], $body['until'] ?? null);
    }

    #[Test]
    public function afterThirtyDaysTheyMayAskAgain(): void
    {
        [$owner, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $token = $this->turnOn($organisation);
        $ada = $this->outsider('ada@gmail.com');
        $this->signIn($ada);
        $this->send('POST', '/api/request-links/ask', ['token' => $token]);
        $this->turnDown($this->membershipOf($ada, $organisation), null, new DateTimeImmutable('-31 days'));

        $this->send('POST', '/api/request-links/ask', ['token' => $token]);

        self::assertResponseStatusCodeSame(201);
        self::assertSame(MembershipStatus::PendingApproval, $this->membershipOf($ada, $organisation)->getStatus());
    }

    #[Test]
    public function theMessageIsAtMostFiveHundredCharacters(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $token = $this->turnOn($organisation);
        $this->signIn($this->outsider('ada@gmail.com'));

        $body = $this->send('POST', '/api/request-links/ask', ['token' => $token, 'message' => Str\repeat('è', 501)]);

        self::assertResponseStatusCodeSame(422);
        self::assertSame([['message', 'Keep your message to 500 characters or fewer.']], $this->violations($body));

        $this->send('POST', '/api/request-links/ask', ['token' => $token, 'message' => Str\repeat('è', 500)]);
        self::assertResponseStatusCodeSame(201);
    }

    #[Test]
    public function anAccountMakesAtMostFiveRequestsADayAcrossOrganisations(): void
    {
        $ada = $this->outsider('ada@gmail.com');
        foreach (['Ìrè Events', 'Okeke Family', 'Lagos Weddings', 'Abuja Hall', 'Eko Hotels'] as $i => $name) {
            self::service(LinkRequester::class)->ask($ada, $this->organisation(Str\format('owner%d@example.com', $i), $name)[1], null);
        }
        [, $sixth] = $this->organisation('owner6@example.com', 'Ibadan Hall');

        try {
            self::service(LinkRequester::class)->ask($ada, $sixth, null);
            self::fail('A sixth request was let through.');
        } catch (ApiException $refusal) {
            self::assertSame(ErrorCode::TooManyAttempts, $refusal->errorCode);
            self::assertStringStartsWith('Too many requests for now. Try again at ', $refusal->getMessage());
            self::assertArrayHasKey('Retry-After', $refusal->headers);
        }

        self::assertNull(self::service(MembershipRepository::class)->findOneBy(['user' => $ada, 'organisation' => $sixth]));
    }

    #[Test]
    public function anOrganisationsDailyLimitReadsAsTheAccountsDoes(): void
    {
        [, $organisation] = $this->organisation('folake@ire.events', 'Ìrè Events');
        $token = $this->turnOn($organisation);
        $ada = $this->outsider('ada@gmail.com');
        self::getContainer()->set('limiter.join_request_organisation', new RefusingRateLimiterFactory(new DateTimeImmutable('+2 hours')));
        $this->signIn($ada);

        $body = $this->send('POST', '/api/request-links/ask', ['token' => $token]);

        self::assertResponseStatusCodeSame(429);
        self::assertStringStartsWith('Too many requests for now. Try again at ', Type\string()->coerce($body['detail']));
        self::assertGreaterThan(7000, (int) $this->client->getResponse()->headers->get('Retry-After'));
        self::assertNull(self::service(MembershipRepository::class)->findOneBy(['user' => $ada, 'organisation' => $organisation]));
    }

    /** @return array{User, Organisation} */
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

    /** Onboarded, with an organisation of their own elsewhere. */
    private function outsider(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Ada Okeke', self::PASSWORD)->user;
        self::onboard($user);

        return $user;
    }

    private function turnOn(Organisation $organisation): string
    {
        $token = \bin2hex(SecureRandom\bytes(16));
        $organisation->setRequestLinkToken($token);
        self::service(EntityManagerInterface::class)->flush();

        return $token;
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

    private function setting(Organisation $organisation): string
    {
        return Str\format('/api/orgs/%s/request-link', $organisation->getId()->toRfc4122());
    }

    /** @param array<string, mixed> $body */
    private function tokenOf(array $body): string
    {
        return Str\after_last(Type\string()->coerce($body['url']), '/') ?? '';
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
