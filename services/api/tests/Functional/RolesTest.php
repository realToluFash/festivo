<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\Organisation\Roles\RoleAssignment;
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
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
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
    public function aNewOrganisationHasExactlyTheFiveSeededRolesInOrder(): void
    {
        $body = $this->as($this->owner, 'GET', $this->path('roles'));

        self::assertSame(['owner', 'administrator', 'event_manager', 'coordinator', 'read_only'], Vec\map(
            Type\vec(Type\shape(['seededAs' => Type\nullable(Type\string())], true))->coerce($body['roles']),
            static fn (array $role): ?string => $role['seededAs'],
        ));
    }

    /** Owner holds everything; the rest hold their defaults, and nobody below Administrator the margin or vendors. */
    #[Test]
    public function eachSeededRoleHoldsItsDefaults(): void
    {
        $everything = Vec\map(Permission::cases(), static fn (Permission $permission): string => $permission->value);
        self::assertSame($everything, $this->as($this->owner, 'GET', $this->path('permissions'))['permissions']);

        foreach ([SeededRole::Administrator, SeededRole::EventManager, SeededRole::Coordinator, SeededRole::ReadOnly] as $seeded) {
            $member = $this->member(Str\format('%s@ire.events', $seeded->value), $seeded);
            $held = Type\vec(Type\string())->coerce($this->as($member, 'GET', $this->path('permissions'))['permissions']);

            self::assertSame(Vec\map($seeded->defaults(), static fn (Permission $permission): string => $permission->value), $held, $seeded->value);
            self::assertSame(SeededRole::Administrator === $seeded, Iter\contains($held, 'budget.margin'), $seeded->value);
            self::assertSame(SeededRole::Administrator === $seeded, Iter\contains($held, 'vendors.manage'), $seeded->value);
        }
    }

    #[Test]
    public function aPermittedMemberEditsASeededRoleAndItsHoldersFollow(): void
    {
        $admin = $this->member('admin@ire.events', SeededRole::Administrator);
        $coordinator = $this->member('coordinator@ire.events', SeededRole::Coordinator);
        $role = $this->seeded(SeededRole::Coordinator);

        $body = $this->as($admin, 'PATCH', $this->path('roles/' . $role), ['permissions' => ['events.read', 'budget.read', 'budget.margin']]);

        self::assertSame(200, $this->statusCode(), Json\encode($body));
        self::assertSame(['events.read', 'budget.read', 'budget.margin'], $this->as($coordinator, 'GET', $this->path('permissions'))['permissions']);
    }

    #[Test]
    public function ownerCannotBeEditedOrDeleted(): void
    {
        $owner = $this->seeded(SeededRole::Owner);

        $this->as($this->owner, 'PATCH', $this->path('roles/' . $owner), ['permissions' => []]);
        self::assertSame(ErrorCode::OwnerRoleFixed->type(), $this->last()['type'] ?? null);
        $this->as($this->owner, 'DELETE', $this->path('roles/' . $owner));
        self::assertSame(ErrorCode::OwnerRoleFixed->type(), $this->last()['type'] ?? null);
    }

    #[Test]
    public function aSeededRoleCannotBeDeleted(): void
    {
        $this->as($this->owner, 'DELETE', $this->path('roles/' . $this->seeded(SeededRole::ReadOnly)));

        self::assertSame(409, $this->statusCode());
        self::assertSame(ErrorCode::SeededRoleKept->type(), $this->last()['type'] ?? null);
    }

    #[Test]
    public function deletingARoleThatPeopleHoldMovesThemToTheReplacement(): void
    {
        $created = $this->as($this->owner, 'POST', $this->path('roles'), ['name' => 'Door team', 'permissions' => ['events.read', 'guests.read']]);
        self::assertSame(201, $this->statusCode(), Json\encode($created));
        $door = Type\string()->coerce($created['id']);
        $tope = $this->member('tope@ire.events', null, $door);

        $this->as($this->owner, 'DELETE', $this->path('roles/' . $door));
        self::assertSame(422, $this->statusCode());
        self::assertSame('Choose the role these people move to.', $this->violation('replacement'));

        $this->as($this->owner, 'DELETE', $this->path('roles/' . $door), ['replacement' => $this->seeded(SeededRole::ReadOnly)]);
        self::assertSame(204, $this->statusCode(), Json\encode($this->last()));
        self::assertSame(
            Vec\map(SeededRole::ReadOnly->defaults(), static fn (Permission $permission): string => $permission->value),
            $this->as($tope, 'GET', $this->path('permissions'))['permissions'],
        );
    }

    #[Test]
    public function aRoleNameIsRequiredShortAndUniqueIgnoringCase(): void
    {
        $this->as($this->owner, 'POST', $this->path('roles'), ['name' => '   ']);
        self::assertSame('Give the role a name.', $this->violation('name'));
        $this->as($this->owner, 'POST', $this->path('roles'), ['name' => Str\repeat('a', 41)]);
        self::assertSame('That is longer than 40 characters.', $this->violation('name'));
        $this->as($this->owner, 'POST', $this->path('roles'), ['name' => '  event MANAGER ']);
        self::assertSame('A role with that name already exists.', $this->violation('name'));
        $this->as($this->owner, 'POST', $this->path('roles'), ['name' => 'Door team', 'permissions' => ['made.up']]);
        self::assertSame(422, $this->statusCode());
    }

    #[Test]
    public function theRolesNeedMembersPermissions(): void
    {
        $coordinator = $this->member('coordinator@ire.events', SeededRole::Coordinator);

        $this->as($coordinator, 'GET', $this->path('roles'));
        self::assertSame(ErrorCode::PermissionRequired->type(), $this->last()['type'] ?? null);
        $this->as($coordinator, 'POST', $this->path('roles'), ['name' => 'Door team']);
        self::assertSame(403, $this->statusCode());
        $other = $this->account('stranger@example.com');
        self::service(OrganisationFounder::class)->found($other, 'Elsewhere', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->as($other, 'GET', $this->path('permissions'));
        self::assertSame(404, $this->statusCode(), 'not a member: not found, never forbidden');
    }

    /** The grid shows every registered permission, so Budget and Vendors can be granted on purpose. */
    #[Test]
    public function theGridListsEveryRegisteredPermissionByArea(): void
    {
        $areas = Type\vec(Type\shape(['area' => Type\string(), 'permissions' => Type\vec(Type\string())]))->coerce(
            $this->as($this->owner, 'GET', $this->path('roles'))['areas'],
        );
        $listed = Vec\flat_map($areas, static fn (array $area): array => $area['permissions']);

        self::assertSame(Vec\map(Permission::cases(), static fn (Permission $permission): string => $permission->value), $listed);
        self::assertContains(['area' => 'budget', 'permissions' => ['budget.read', 'budget.manage', 'budget.margin']], $areas);
        self::assertContains(['area' => 'vendors', 'permissions' => ['vendors.read', 'vendors.manage']], $areas);
    }

    #[Test]
    public function theLastOwnerCannotBeMovedOffOwner(): void
    {
        $membership = self::em()->getRepository(Membership::class)->findOneBy(['user' => $this->owner]) ?? self::fail('no membership');
        $admin = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => SeededRole::Administrator]) ?? self::fail('no role');

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

    /** sc-509's approvers, now that Administrator exists. */
    #[Test]
    public function anAdministratorAnswersRequestsToGetBackIn(): void
    {
        $admin = $this->member('admin@ire.events', SeededRole::Administrator);
        $person = $this->member('person@ire.events', SeededRole::Coordinator);

        $approvers = Vec\map(self::service(RecoveryApprovers::class)->for($person), static fn (User $user): string => $user->getId()->toRfc4122());

        self::assertContains($admin->getId()->toRfc4122(), $approvers);
        self::assertContains($this->owner->getId()->toRfc4122(), $approvers);
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        self::onboard($user, withOrganisation: false);

        return $user;
    }

    private function member(string $address, ?SeededRole $seeded, ?string $roleId = null): User
    {
        $user = $this->account($address);
        $role = null === $seeded
            ? self::em()->find(Role::class, $roleId)
            : self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]);
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        self::em()->persist(new Membership($organisation, $user, Type\instance_of(Role::class)->coerce($role), MembershipStatus::Active));
        self::em()->flush();

        return $user;
    }

    private function seeded(SeededRole $seeded): string
    {
        $role = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $this->organisation, 'seededAs' => $seeded]);

        return Type\instance_of(Role::class)->coerce($role)->getId()->toRfc4122();
    }

    private function path(string $rest): string
    {
        return '/api/orgs/' . $this->organisation->getId()->toRfc4122() . '/' . $rest;
    }

    private function violation(string $field): ?string
    {
        foreach (Type\vec(Type\shape(['propertyPath' => Type\string(), 'message' => Type\string()], true))->coerce($this->last()['violations'] ?? []) as $violation) {
            if ($violation['propertyPath'] === $field) {
                return $violation['message'];
            }
        }

        return null;
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
