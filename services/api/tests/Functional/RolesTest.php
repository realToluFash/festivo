<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Organisation\Roles\RoleAssignment;
use App\Domain\Organisation\Roles\RoleManager;
use App\Domain\User\TwoFactor\Recovery\RecoveryApprovers;
use App\Domain\User\UserRegistrar;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\MembershipStatus;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Http\Exception\ApiException;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

final class RolesTest extends ApiTestCase
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
        $this->owner = $this->account('owner@ire.events');
        $this->organisation = self::service(OrganisationFounder::class)->found($this->owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
    }

    #[Test]
    public function everyOrganisationHasExactlyOwnerAdminAndMemberInOrder(): void
    {
        $body = $this->as($this->owner, 'GET', $this->path('roles'));

        self::assertSame(['owner', 'administrator', 'member'], Vec\map(
            Type\vec(Type\shape(['seededAs' => Type\string()], true))->coerce($body['roles']),
            static fn (array $role): string => $role['seededAs'],
        ));
    }

    /** Owner holds everything, Admin all of it but billing.manage, and a Member nothing across the organisation (sc-29912). */
    #[Test]
    public function eachRoleHoldsWhatItIsFixedToHold(): void
    {
        $everything = Vec\map(Permission::cases(), static fn (Permission $permission): string => $permission->value);
        self::assertSame($everything, $this->as($this->owner, 'GET', $this->path('permissions'))['permissions']);

        $admin = $this->member('admin@ire.events', SeededRole::Admin);
        $held = Type\vec(Type\string())->coerce($this->as($admin, 'GET', $this->path('permissions'))['permissions']);
        self::assertSame(Vec\filter($everything, static fn (string $permission): bool => 'billing.manage' !== $permission), $held);

        $member = $this->member('member@ire.events', SeededRole::Member);
        self::assertSame([], $this->as($member, 'GET', $this->path('permissions'))['permissions']);
    }

    /** The role-editing routes are gone: nothing serves them (sc-29912). */
    #[Test]
    #[DataProvider('editing')]
    public function aRoleCannotBeCreatedEditedOrRemoved(string $method, string $rest): void
    {
        $member = $this->seeded(SeededRole::Member);
        $this->as($this->owner, $method, $this->path(Str\replace($rest, '{role}', $member)), ['name' => 'Door team', 'permissions' => ['events.read']]);

        self::assertContains($this->statusCode(), [404, 405]);
        self::assertSame(['owner', 'administrator', 'member'], Vec\map($this->roles(), static fn (array $role): mixed => $role['seededAs']));
        self::assertSame([], $this->permissionsOf($member));
    }

    /** @return iterable<string, array{string, string}> */
    public static function editing(): iterable
    {
        yield 'create' => ['POST', 'roles'];
        yield 'edit' => ['PATCH', 'roles/{role}'];
        yield 'remove' => ['DELETE', 'roles/{role}'];
    }

    #[Test]
    public function theRolesNeedMembersPermissions(): void
    {
        $member = $this->member('member@ire.events', SeededRole::Member);

        $this->as($member, 'GET', $this->path('roles'));
        self::assertSame(ErrorCode::PermissionRequired->type(), $this->last()['type'] ?? null);
        $other = $this->account('stranger@example.com');
        self::service(OrganisationFounder::class)->found($other, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->as($other, 'GET', $this->path('permissions'));
        self::assertSame(404, $this->statusCode(), 'not a member: not found, never forbidden');
    }

    #[Test]
    public function theLastOwnerCannotBeMovedOffOwner(): void
    {
        $membership = self::em()->getRepository(Membership::class)->findOneBy(['user' => $this->owner]) ?? self::fail('no membership');
        $admin = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => SeededRole::Admin]) ?? self::fail('no role');

        try {
            self::service(RoleAssignment::class)->assign($membership, $admin);
            self::fail('the last owner was demoted');
        } catch (ApiException $e) {
            self::assertSame(ErrorCode::LastOwner, $e->errorCode);
        }

        $second = $this->member('second@ire.events', SeededRole::Owner);
        self::service(RoleAssignment::class)->assign($membership, $admin);
        self::assertTrue(self::em()->getRepository(Membership::class)->findOneBy(['user' => $second])?->getRole()->isOwner());
    }

    #[Test]
    public function aRoleNamesWhomItCountsByNameIgnoringCaseAndAccentsThenByEmail(): void
    {
        $door = $this->seeded(SeededRole::Member);
        $this->member('zara@ire.events', null, $door, name: 'zara Bello');
        $this->member('emeka@ire.events', null, $door, MembershipStatus::Suspended, name: 'Émeka Obi');
        $this->member('ada2@ire.events', null, $door, name: 'Ada Okeke');
        $this->member('ada1@ire.events', null, $door, name: 'Ada Okeke');
        $this->member('bisi@ire.events', null, $door, name: 'bisi Ade');
        $this->member('left@ire.events', null, $door, MembershipStatus::LeftOrRemoved, name: 'Aaron Left');
        $this->member('asked@ire.events', null, $door, MembershipStatus::PendingApproval, name: 'Aaron Asked');

        $listed = Iter\first(Vec\filter($this->roles(), static fn (array $role): bool => $door === $role['id'])) ?? self::fail('no role');

        self::assertSame(5, $listed['holders']);
        self::assertSame([
            ['name' => 'Ada Okeke', 'suspended' => false],
            ['name' => 'Ada Okeke', 'suspended' => false],
            ['name' => 'bisi Ade', 'suspended' => false],
            ['name' => 'Émeka Obi', 'suspended' => true],
            ['name' => 'zara Bello', 'suspended' => false],
        ], $listed['holderNames']);
    }

    #[Test]
    public function namesThatTieAreOrderedByEmail(): void
    {
        $door = $this->seeded(SeededRole::Member);
        $this->member('b@ire.events', null, $door, name: 'Ada Okeke');
        $this->member('c@ire.events', null, $door, name: 'ada okeke');
        $this->member('a@ire.events', null, $door, name: 'Ada Okeke');
        $role = self::em()->find(Role::class, $door) ?? self::fail('no role');

        self::assertSame(['a@ire.events', 'b@ire.events', 'c@ire.events'], Vec\map(
            self::service(RoleManager::class)->holdersOf($role),
            static fn (Membership $membership): string => $membership->getUser()->getPrimaryEmailAddress()?->getAddress() ?? '',
        ));
    }

    #[Test]
    public function anOrganisationWithNobodyElseListsOnlyItsOwner(): void
    {
        $roles = $this->roles();

        foreach ($roles as $role) {
            self::assertCount(Type\int()->coerce($role['holders']), Type\vec(Type\mixed())->coerce($role['holderNames']));
        }
        self::assertSame([['name' => 'Person', 'suspended' => false]], Iter\first($roles)['holderNames'] ?? null);
    }

    #[Test]
    public function anAdministratorAnswersRequestsToGetBackIn(): void
    {
        $admin = $this->member('admin@ire.events', SeededRole::Admin);
        $person = $this->member('person@ire.events', SeededRole::Member);

        $approvers = Vec\map(self::service(RecoveryApprovers::class)->for($person), static fn (User $user): string => $user->getId()->toRfc4122());

        self::assertContains($admin->getId()->toRfc4122(), $approvers);
        self::assertContains($this->owner->getId()->toRfc4122(), $approvers);
    }

    private function account(string $address, string $name = 'Person'): User
    {
        $user = self::service(UserRegistrar::class)->register($address, $name, self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, ?SeededRole $seeded, ?string $roleId = null, MembershipStatus $status = MembershipStatus::Active, string $name = 'Person'): User
    {
        $user = $this->account($address, $name);
        $role = null === $seeded
            ? self::em()->find(Role::class, $roleId)
            : self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $membership = new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), $status->isEntry() ? $status : MembershipStatus::Active, new DateTimeImmutable());

        if (!$status->isEntry()) {
            $membership->setStatus($status, new DateTimeImmutable());
        }

        self::em()->persist($membership);
        self::em()->flush();

        return $user;
    }

    private function seeded(SeededRole $seeded): string
    {
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]);

        return Type\instance_of(Role::class)->coerce($role)->getId()->toRfc4122();
    }

    /** @return list<array<array-key, mixed>> */
    private function roles(): array
    {
        return Type\vec(Type\dict(Type\array_key(), Type\mixed()))->coerce($this->as($this->owner, 'GET', $this->path('roles'))['roles']);
    }

    /** @return list<string> */
    private function permissionsOf(string $roleId): array
    {
        $role = Iter\first(Vec\filter($this->roles(), static fn (array $role): bool => $roleId === $role['id']));

        return Type\vec(Type\string())->coerce($role['permissions'] ?? null);
    }

    private function path(string $rest): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/' . $rest;
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function as(User $user, string $method, string $path, ?array $body = null): array
    {
        $who = self::em()->find(User::class, $user->getId()) ?? self::fail('no user');
        $this->client->request($method, $path, server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($who),
        ], content: null === $body ? null : Json\encode($body));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
