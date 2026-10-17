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
    }

    public function down(Schema $schema): void
    {
        $this->addSql("DELETE FROM roles WHERE seeded_as IN ('administrator', 'event_manager', 'coordinator', 'read_only')");
        $this->addSql('ALTER TABLE roles DROP permissions');
    }
}
