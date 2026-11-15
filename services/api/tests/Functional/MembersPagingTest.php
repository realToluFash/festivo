<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\Members\MembershipMachine;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\MembershipChannel;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Enum\Suspension;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** Settings › Members a page at a time (sc-49170): every person reached once, and the counts always the whole organisation's. */
final class MembersPagingTest extends ApiTestCase
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
        $this->owner = $this->account('folake@ire.events', 'Folake Adeyemi');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();

        foreach (['ada', 'bisi', 'chidi', 'dayo', 'emeka', 'funmi'] as $name) {
            $this->member($name, MembershipStatus::Active);
        }

        $this->moved($this->member('gbenga', MembershipStatus::Active), MembershipStatus::Suspended);
        $this->moved($this->member('hauwa', MembershipStatus::Active), MembershipStatus::LeftOrRemoved);
        $this->member('ife', MembershipStatus::PendingApproval);
    }

    #[Test]
    public function pagesReachEveryPersonUnderAnOptionOnceAndInOrder(): void
    {
        $whole = $this->ids($this->list('?limit=500'));
        $paged = [];
        $after = null;

        do {
            $page = $this->list('?limit=3' . (null === $after ? '' : '&after=' . $after));
            $paged = [...$paged, ...$this->ids($page)];
            $after = Type\nullable(Type\string())->coerce($page['next']);
        } while (null !== $after);

        self::assertCount(8, $whole, 'the owner, six active and one suspended');
        self::assertSame($whole, $paged);
        self::assertCount(1, $this->ids($this->list('?show=former')));
        self::assertNull($this->list('?show=former')['next']);
    }

    #[Test]
    public function everyPageCountsTheWholeOrganisation(): void
    {
        $page = $this->list('?limit=2');

        self::assertSame(['all' => 8, 'active' => 7, 'waiting' => 1, 'suspended' => 1, 'former' => 1], $page['counts']);
        self::assertSame(1, $page['owners']);
        self::assertCount(2, $this->ids($page));
        self::assertSame(Vec\take($this->ids($this->list()), 5), $this->ids($page, 'faces'));
        self::assertSame(['ife@ire.events'], Vec\map(
            Type\vec(Type\shape(['user' => Type\shape(['email' => Type\string()], true)], true))->coerce($page['waiting']),
            static fn (array $member): string => $member['user']['email'],
        ));
    }

    #[Test]
    public function anOptionTheFilterLacksOrAPageOutOfRangeIsRefused(): void
    {
        $refused = [
            '?show=invited' => 'show',
            '?limit=0' => 'limit',
            '?limit=501' => 'limit',
            '?limit=fifty' => 'limit',
            '?after=0190f0a4-0000-7000-8000-000000000000' => 'after',
            '?after=nobody' => 'after',
        ];

        foreach ($refused as $query => $parameter) {
            $body = Type\shape(['violations' => Type\vec(Type\shape(['propertyPath' => Type\string()], true))], true)->coerce($this->list($query, 422));
            self::assertSame($parameter, $body['violations'][0]['propertyPath'] ?? null, $query);
        }
    }

    /** @return array<string, mixed> */
    private function list(string $query = '', int $status = 200): array
    {
        $who = self::em()->find(User::class, $this->owner->getId()) ?? self::fail('no owner');
        $this->client->request('GET', Str\format('/api/orgs/%s/members%s', $this->organisation->getId()->toRfc4122(), $query), server: [
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
        ]);
        $body = Type\dict(Type\string(), Type\mixed())->coerce(Json\decode((string) $this->client->getResponse()->getContent()));
        self::assertSame($status, $this->client->getResponse()->getStatusCode(), Json\encode($body));

        return $body;
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return list<string>
     */
    private function ids(array $body, string $key = 'members'): array
    {
        return Vec\map(Type\vec(Type\shape(['id' => Type\string()], true))->coerce($body[$key]), static fn (array $member): string => $member['id']);
    }

    private function account(string $address, string $name): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $name, MembershipStatus $status): Membership
    {
        $user = $this->account($name . '@ire.events', Str\uppercase($name[0]) . Str\slice($name, 1));
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => SeededRole::Member]) ?? self::fail('no role');
        $membership = new Membership($organisation, $user, $role, $status, new DateTimeImmutable());
        self::em()->persist($membership);
        self::em()->flush();

        return $membership;
    }

    private function moved(Membership $membership, MembershipStatus $to): void
    {
        self::service(MembershipMachine::class)->move($membership, $to, MembershipChannel::Settings, $this->owner, why: MembershipStatus::Suspended === $to ? Suspension::Manual : null);
        self::em()->flush();
    }
}
