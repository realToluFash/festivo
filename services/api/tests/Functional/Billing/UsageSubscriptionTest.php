<?php

declare(strict_types=1);

namespace App\Tests\Functional\Billing;

use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use Lcobucci\JWT\Encoding\JoseEncoder;
use Lcobucci\JWT\Token\Parser;
use Lcobucci\JWT\UnencryptedToken;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;

/** sc-3929: an organisation's usage reaches its Owners and Admins on its own live topic, and a Member is refused as Plan and billing refuses them. */
final class UsageSubscriptionTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private User $owner;
    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();

        $this->owner = $this->account('folake@ire.events');
        self::onboard($this->owner, withOrganisation: false);
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ire Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
    }

    #[Test]
    public function anOwnerAndAnAdminAreGivenTheOrganisationsUsageTopicAndNoOther(): void
    {
        $other = $this->account('tomi@elsewhere.events');
        self::onboard($other, withOrganisation: false);
        self::service(OrganisationFounder::class)->found($other, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $topic = 'orgs/' . $this->organisation->getId()->toRfc4122() . '/usage';

        foreach ([$this->owner, $this->member('ada@ire.events', SeededRole::Admin)] as $user) {
            self::assertSame(['subscribe' => [$topic]], $this->subscribe($user)->claims()->get('mercure'));
        }
    }

    #[Test]
    public function aMemberIsRefused(): void
    {
        $this->request($this->member('bayo@ire.events', SeededRole::Member));

        self::assertResponseStatusCodeSame(403);
        self::assertArrayNotHasKey('token', $this->body());
    }

    #[Test]
    public function somebodyOutsideTheOrganisationIsRefused(): void
    {
        $stranger = $this->account('tomi@elsewhere.events');
        self::onboard($stranger);

        $this->request($stranger);

        self::assertArrayNotHasKey('token', $this->body());
        self::assertContains($this->client->getResponse()->getStatusCode(), [403, 404]);
    }

    #[Test]
    public function somebodySignedOutIsGivenNothing(): void
    {
        $this->client->request('POST', $this->path(), server: ['CONTENT_TYPE' => 'application/json']);

        self::assertResponseStatusCodeSame(401);
        self::assertArrayNotHasKey('token', $this->body());
    }

    private function subscribe(User $as): UnencryptedToken
    {
        $this->request($as);
        self::assertResponseIsSuccessful();

        return Type\instance_of(UnencryptedToken::class)->coerce(new Parser(new JoseEncoder())->parse(Type\non_empty_string()->coerce($this->body()['token'])));
    }

    private function request(User $as): void
    {
        $this->client->request('POST', $this->path(), server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($as),
        ]);
    }

    private function path(): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/usage/subscriptions';
    }

    /** @return array<string, mixed> */
    private function body(): array
    {
        return Type\dict(Type\string(), Type\mixed())->coerce(Json\decode((string) $this->client->getResponse()->getContent()));
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
}
