<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Organisation;
use App\Entity\Role;
use App\Enum\Permission;
use App\Enum\SeededRole;
use App\Tests\FunctionalTestCase;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\DependencyFactory;
use Doctrine\Migrations\Version\Version;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Type;
use Psl\Vec;

final class EventsCreateGrantTest extends FunctionalTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    #[Test]
    public function administratorAndEventManagerHoldItOnceAndNoOtherRoleGainsIt(): void
    {
        $organisation = $this->organisationFoundedBeforeTheGrant();
        $custom = Role::custom($organisation, 'Ushers', [Permission::EventsManage]);
        self::em()->persist($custom);
        self::em()->flush();

        $this->migrate();

        self::assertSame(1, $this->held(SeededRole::Administrator, $organisation));
        self::assertSame(1, $this->held(SeededRole::EventManager, $organisation));
        self::assertSame(0, $this->held(SeededRole::Coordinator, $organisation));
        self::assertSame(0, $this->held(SeededRole::ReadOnly, $organisation));
        self::assertSame(0, $this->occurrences($custom->getId()->toRfc4122()));
    }

    #[Test]
    public function aSecondRunGrantsNothingMore(): void
    {
        $organisation = $this->organisationFoundedBeforeTheGrant();

        $this->migrate();
        $this->migrate();

        self::assertSame(1, $this->held(SeededRole::Administrator, $organisation));
        self::assertSame(1, $this->held(SeededRole::EventManager, $organisation));
    }

    /** Administrator already holds it, as an organisation that granted it by hand would; Event manager does not. */
    private function organisationFoundedBeforeTheGrant(): Organisation
    {
        $owner = self::service(UserRegistrar::class)->register('owner@ire.events', 'Folake', self::PASSWORD)->user;
        self::em()->flush();
        $organisation = self::service(OrganisationFounder::class)->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();

        foreach (self::em()->getRepository(Role::class)->findBy(['organisation' => $organisation]) as $role) {
            if (SeededRole::Administrator !== $role->getSeededAs()) {
                $role->setPermissions(Vec\filter($role->getPermissions(), static fn (Permission $permission): bool => Permission::EventsCreate !== $permission));
            }
        }

        self::em()->flush();

        return $organisation;
    }

    private function migrate(): void
    {
        $factory = self::serviceById('doctrine.migrations.dependency_factory', DependencyFactory::class);
        $migration = $factory->getMigrationRepository()->getMigration(new Version('DoctrineMigrations\Version20261021180100'))->getMigration();
        $migration->up(new Schema());

        foreach ($migration->getSql() as $query) {
            self::em()->getConnection()->executeStatement($query->getStatement());
        }

        self::em()->clear();
    }

    private function held(SeededRole $seeded, Organisation $organisation): int
    {
        $id = self::em()->getConnection()->fetchOne(
            'SELECT id FROM roles WHERE organisation_id = :organisation AND seeded_as = :seeded',
            ['organisation' => $organisation->getId()->toRfc4122(), 'seeded' => $seeded->value],
        );

        return $this->occurrences(Type\string()->coerce($id));
    }

    /** Read from the column, since the entity would hide a duplicate. */
    private function occurrences(string $roleId): int
    {
        $permissions = self::em()->getConnection()->fetchOne('SELECT permissions FROM roles WHERE id = :id', ['id' => $roleId]);
        $values = Json\typed(Type\string()->coerce($permissions), Type\vec(Type\string()));

        return Iter\count(Vec\filter($values, static fn (string $value): bool => Permission::EventsCreate->value === $value));
    }
}
