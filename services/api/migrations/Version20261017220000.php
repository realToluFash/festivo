<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017220000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Roles carry permissions, and every organisation gets the four seeded roles below Owner with their defaults.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE roles ADD permissions JSON DEFAULT '[]' NOT NULL");
        $this->addSql(<<<'SQL'
            INSERT INTO roles (
                id,
                organisation_id,
                seeded_as,
                name,
                permissions,
                created_at,
                updated_at
            )
            SELECT gen_random_uuid(), o.id, 'administrator', NULL, '["events.read","events.manage","guests.read","guests.manage","seating.read","seating.manage","menu.read","menu.manage","run_of_show.read","run_of_show.manage","staff.read","staff.manage","messages.read","messages.manage","reports.read","reports.manage","budget.read","budget.manage","budget.margin","vendors.read","vendors.manage","members.read","members.manage","billing.read","organisation.manage"]', NOW(), NOW()
              FROM organisations o
             WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.organisation_id = o.id AND r.seeded_as = 'administrator')
            SQL);
        $this->addSql(<<<'SQL'
            INSERT INTO roles (
                id,
                organisation_id,
                seeded_as,
                name,
                permissions,
                created_at,
                updated_at
            )
            SELECT gen_random_uuid(), o.id, 'event_manager', NULL, '["events.read","events.manage","guests.read","guests.manage","seating.read","seating.manage","menu.read","menu.manage","run_of_show.read","run_of_show.manage","staff.read","staff.manage","messages.read","messages.manage","reports.read","reports.manage","budget.read","budget.manage"]', NOW(), NOW()
              FROM organisations o
             WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.organisation_id = o.id AND r.seeded_as = 'event_manager')
            SQL);
        $this->addSql(<<<'SQL'
            INSERT INTO roles (
                id,
                organisation_id,
                seeded_as,
                name,
                permissions,
                created_at,
                updated_at
            )
            SELECT gen_random_uuid(), o.id, 'coordinator', NULL, '["events.read","events.manage","guests.read","guests.manage","seating.read","seating.manage","menu.read","menu.manage","run_of_show.read","run_of_show.manage","staff.read","messages.read","messages.manage","reports.read","budget.read"]', NOW(), NOW()
              FROM organisations o
             WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.organisation_id = o.id AND r.seeded_as = 'coordinator')
            SQL);
        $this->addSql(<<<'SQL'
            INSERT INTO roles (
                id,
                organisation_id,
                seeded_as,
                name,
                permissions,
                created_at,
                updated_at
            )
            SELECT gen_random_uuid(), o.id, 'read_only', NULL, '["events.read","guests.read","seating.read","menu.read","run_of_show.read","staff.read","messages.read","reports.read","budget.read"]', NOW(), NOW()
              FROM organisations o
             WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.organisation_id = o.id AND r.seeded_as = 'read_only')
            SQL);
        // The service checks names against the seeded labels too; this holds two custom ones apart under a race.
        $this->addSql('CREATE UNIQUE INDEX uniq_role_name_per_organisation ON roles (organisation_id, LOWER(name)) WHERE name IS NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $held = $this->connection->fetchOne("SELECT COUNT(*) FROM memberships m JOIN roles r ON r.id = m.role_id WHERE r.seeded_as IS DISTINCT FROM 'owner'");
        $this->abortIf((int) $held > 0, 'Members hold roles this rollback would delete. Move them to Owner by hand first, deliberately.');
        $this->addSql('DROP INDEX IF EXISTS uniq_role_name_per_organisation');
        $this->addSql("DELETE FROM roles WHERE seeded_as IS DISTINCT FROM 'owner'");
        $this->addSql('ALTER TABLE roles DROP permissions');
    }
}
