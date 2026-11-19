<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Membership;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Enum\EventType;
use App\Enum\MembershipStatus;
use App\Enum\SeededRole;
use App\Tests\FunctionalTestCase;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\DependencyFactory;
use Doctrine\Migrations\Version\Version;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;

/** Version20261104120100 run against the roles as they were before sc-29912, put back for the test. */
final class ThreeRolesMigrationTest extends FunctionalTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private Organisation $organisation;

    /** @var array{string, string} */
    private array $events;

    protected function setUp(): void
    {
        parent::setUp();
        $owner = self::service(UserRegistrar::class)->register('owner@ire.events', 'Folake', self::PASSWORD)->user;
        self::em()->flush();
        $this->organisation = self::service(OrganisationFounder::class)->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->events = [$this->event('Owambe'), $this->event('Naming')];

        $this->db()->executeStatement("ALTER TABLE roles ADD name VARCHAR(40) DEFAULT NULL, ADD permissions JSON NOT NULL DEFAULT '[]', ALTER seeded_as DROP NOT NULL");
        $this->db()->executeStatement("DELETE FROM roles WHERE organisation_id = :o AND seeded_as = 'member'", ['o' => $this->organisation->getId()->toRfc4122()]);
    }

    #[Test]
    public function everyoneButOwnersAndAdminsBecomesAMemberWithTheEventRoleTheirOldRoleReached(): void
    {
        $manager = $this->holding('manager@ire.events', $this->oldRole('event_manager', null, ['events.read', 'events.manage', 'guests.manage', 'budget.manage']));
        $coordinator = $this->oldRole('coordinator', null, ['events.read', 'events.manage', 'guests.manage']);
        $editor = $this->holding('editor@ire.events', $coordinator);
        $away = $this->holding('away@ire.events', $coordinator, MembershipStatus::Suspended);
        $gone = $this->holding('gone@ire.events', $coordinator, MembershipStatus::LeftOrRemoved);
        $door = $this->holding('door@ire.events', $this->oldRole(null, 'Door team', ['events.read', 'guests.read', 'guests.manage']));
        $reader = $this->holding('reader@ire.events', $this->oldRole('read_only', null, ['events.read']));
        $nothing = $this->holding('nothing@ire.events', $this->oldRole(null, 'Finance', ['billing.read']));
        $admin = $this->holding('admin@ire.events', $this->seeded('administrator'));

        $this->migrate();

        self::assertSame(['administrator', 'member', 'owner'], Type\vec(Type\string())->coerce($this->db()->fetchFirstColumn(
            'SELECT seeded_as FROM roles WHERE organisation_id = :o ORDER BY seeded_as',
            ['o' => $this->organisation->getId()->toRfc4122()],
        )));
        foreach ([$manager, $editor, $away, $gone, $door, $reader, $nothing] as $membership) {
            self::assertSame('member', $this->roleOf($membership), $membership);
        }
        self::assertSame('administrator', $this->roleOf($admin));

        self::assertSame(['lead', 'lead'], $this->eventRolesOf($manager));
        self::assertSame(['can_edit', 'can_edit'], $this->eventRolesOf($editor));
        self::assertSame(['can_edit', 'can_edit'], $this->eventRolesOf($away), 'suspended: kept for a restore');
        self::assertSame([], $this->eventRolesOf($gone));
        self::assertSame(['can_check_in', 'can_check_in'], $this->eventRolesOf($door));
        self::assertSame(['can_view', 'can_view'], $this->eventRolesOf($reader));
        self::assertSame([], $this->eventRolesOf($nothing));
        self::assertSame([], $this->eventRolesOf($admin));

        self::assertSame(10, $this->audited('event_person.added'));
        self::assertSame(7, $this->audited('membership.role_changed'));
        self::assertSame(5, $this->audited('role.deleted'));
        $changed = $this->db()->fetchOne("SELECT changes FROM audit_entries WHERE action = 'membership.role_changed' AND subject_id = :m", ['m' => $door]);
        self::assertSame(['Door team', 'member'], Json\typed(Type\string()->coerce($changed), Type\shape(['role' => Type\vec(Type\string())], true))['role']);
    }

    private function migrate(): void
    {
        $factory = self::serviceById('doctrine.migrations.dependency_factory', DependencyFactory::class);
        $migration = $factory->getMigrationRepository()->getMigration(new Version('DoctrineMigrations\Version20261104120100'))->getMigration();
        $migration->up(new Schema());

        foreach ($migration->getSql() as $query) {
            $this->db()->executeStatement($query->getStatement());
        }
    }

    /** @param list<string> $permissions */
    private function oldRole(?string $seededAs, ?string $name, array $permissions): string
    {
        $id = $this->db()->fetchOne(
            'INSERT INTO roles (id, organisation_id, seeded_as, name, permissions, created_at, updated_at) VALUES (gen_random_uuid(), :o, :s, :n, :p, now(), now()) RETURNING id',
            ['o' => $this->organisation->getId()->toRfc4122(), 's' => $seededAs, 'n' => $name, 'p' => Json\encode($permissions)],
        );

        return Type\string()->coerce($id);
    }

    private function seeded(string $seededAs): string
    {
        return Type\string()->coerce($this->db()->fetchOne(
            'SELECT id FROM roles WHERE organisation_id = :o AND seeded_as = :s',
            ['o' => $this->organisation->getId()->toRfc4122(), 's' => $seededAs],
        ));
    }

    /** A membership made on the Admin role, then moved by hand onto a role the entity can no longer load. */
    private function holding(string $address, string $roleId, MembershipStatus $status = MembershipStatus::Active): string
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Person', self::PASSWORD)->user;
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $admin = self::em()->getRepository(Role::class)->findOneBy(['organisation' => $organisation, 'seededAs' => SeededRole::Admin]) ?? self::fail('no role');
        $membership = new Membership($organisation, $user, $admin, MembershipStatus::Active, new DateTimeImmutable());
        self::em()->persist($membership);
        self::em()->flush();
        self::em()->clear();
        $this->db()->executeStatement('UPDATE memberships SET role_id = :r, status = :s WHERE id = :m', ['r' => $roleId, 's' => $status->value, 'm' => $membership->getId()->toRfc4122()]);

        return $membership->getId()->toRfc4122();
    }

    private function event(string $name): string
    {
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $event = new Event($organisation, $name, EventType::Other, new DateTimeImmutable('2030-11-14 16:00'), new DateTimeImmutable('2030-11-14 22:00'), 'NGN');
        self::em()->persist($event);
        self::em()->flush();

        return $event->getId()->toRfc4122();
    }

    private function roleOf(string $membership): string
    {
        return Type\string()->coerce($this->db()->fetchOne('SELECT r.seeded_as FROM memberships m JOIN roles r ON r.id = m.role_id WHERE m.id = :m', ['m' => $membership]));
    }

    /** @return list<string> */
    private function eventRolesOf(string $membership): array
    {
        return Type\vec(Type\string())->coerce($this->db()->fetchFirstColumn(
            'SELECT role FROM event_people WHERE membership_id = :m AND event_id IN (:a, :b) ORDER BY role',
            ['m' => $membership, 'a' => $this->events[0], 'b' => $this->events[1]],
        ));
    }

    private function audited(string $action): int
    {
        return Type\int()->coerce($this->db()->fetchOne('SELECT count(*) FROM audit_entries WHERE action = :a', ['a' => $action]));
    }

    private function db(): Connection
    {
        return self::service(Connection::class);
    }
}
