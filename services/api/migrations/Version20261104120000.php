<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261104120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Three organisation roles, Owner, Admin and Member, and a role on each event (sc-29912): everyone else becomes a Member with a role on every event their old role reached, and each change is audited.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE event_people (
                id            UUID NOT NULL,
                event_id      UUID NOT NULL,
                membership_id UUID NOT NULL,
                role          VARCHAR(20) NOT NULL,
                job_label     VARCHAR(60) DEFAULT NULL,
                created_at    TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at    TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_event_person ON event_people (event_id, membership_id)');
        $this->addSql('CREATE INDEX idx_event_person_membership ON event_people (membership_id)');
        $this->addSql('CREATE INDEX IDX_1A8F1D7471F7E88B ON event_people (event_id)');
        $this->addSql('ALTER TABLE event_people ADD CONSTRAINT FK_1A8F1D7471F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE event_people ADD CONSTRAINT FK_1A8F1D741FB354CD FOREIGN KEY (membership_id) REFERENCES memberships (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            INSERT INTO roles (id, organisation_id, seeded_as, name, permissions, created_at, updated_at)
            SELECT gen_random_uuid(), o.id, 'member', NULL, '[]', now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'
            FROM   organisations o
            WHERE  NOT EXISTS (SELECT 1 FROM roles r WHERE r.organisation_id = o.id AND r.seeded_as = 'member')
            SQL);

        // What each old role reached becomes the nearest event role, by what it held: Door staff is guests.manage without events.manage.
        $this->addSql(<<<'SQL'
            CREATE TEMPORARY TABLE moved_roles AS
            SELECT r.id AS role_id,
                   r.organisation_id,
                   COALESCE(r.seeded_as, r.name) AS was,
                   CASE
                       WHEN jsonb_exists(r.permissions::jsonb, 'budget.manage') THEN 'lead'
                       WHEN jsonb_exists(r.permissions::jsonb, 'events.manage') THEN 'can_edit'
                       WHEN jsonb_exists(r.permissions::jsonb, 'guests.manage') THEN 'can_check_in'
                       WHEN jsonb_exists(r.permissions::jsonb, 'events.read') THEN 'can_view'
                   END AS event_role,
                   (SELECT m.id FROM roles m WHERE m.organisation_id = r.organisation_id AND m.seeded_as = 'member') AS member_role_id
            FROM   roles r
            WHERE  r.seeded_as IS NULL OR r.seeded_as NOT IN ('owner', 'administrator', 'member')
            SQL);

        // A suspended member's roles are kept for a restore; a request or a former member has none to keep.
        $this->addSql(<<<'SQL'
            WITH added AS (
                INSERT INTO event_people (id, event_id, membership_id, role, job_label, created_at, updated_at)
                SELECT gen_random_uuid(), e.id, ms.id, mr.event_role, NULL, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'
                FROM   memberships ms
                JOIN   moved_roles mr ON mr.role_id = ms.role_id
                JOIN   events e ON e.organisation_id = ms.organisation_id
                WHERE  mr.event_role IS NOT NULL
                  AND  ms.status IN ('active', 'suspended')
                RETURNING id, event_id, membership_id, role
            )
            INSERT INTO audit_entries (id, occurred_at, actor_type, actor_id, actor_label, subject_type, subject_id, action, changes, ip, correlation_id)
            SELECT gen_random_uuid(), now() AT TIME ZONE 'UTC', 'system', NULL, NULL, 'EventPerson', a.id, 'event_person.added',
                   json_build_object('eventId', json_build_array(NULL, a.event_id), 'membershipId', json_build_array(NULL, a.membership_id), 'role', json_build_array(NULL, a.role)),
                   NULL, NULL
            FROM   added a
            SQL);

        $this->addSql(<<<'SQL'
            INSERT INTO audit_entries (id, occurred_at, actor_type, actor_id, actor_label, subject_type, subject_id, action, changes, ip, correlation_id)
            SELECT gen_random_uuid(), now() AT TIME ZONE 'UTC', 'system', NULL, NULL, 'Membership', ms.id, 'membership.role_changed',
                   json_build_object('roleId', json_build_array(ms.role_id, mr.member_role_id), 'role', json_build_array(mr.was, 'member')),
                   NULL, NULL
            FROM   memberships ms
            JOIN   moved_roles mr ON mr.role_id = ms.role_id
            SQL);
        $this->addSql('UPDATE memberships ms SET role_id = mr.member_role_id FROM moved_roles mr WHERE mr.role_id = ms.role_id');

        $this->addSql(<<<'SQL'
            INSERT INTO audit_entries (id, occurred_at, actor_type, actor_id, actor_label, subject_type, subject_id, action, changes, ip, correlation_id)
            SELECT gen_random_uuid(), now() AT TIME ZONE 'UTC', 'system', NULL, NULL, 'Invitation', i.id, 'invitation.role_changed',
                   json_build_object('roleId', json_build_array(i.role_id, mr.member_role_id), 'role', json_build_array(mr.was, 'member')),
                   NULL, NULL
            FROM   invitations i
            JOIN   moved_roles mr ON mr.role_id = i.role_id
            SQL);
        $this->addSql('UPDATE invitations i SET role_id = mr.member_role_id FROM moved_roles mr WHERE mr.role_id = i.role_id');

        $this->addSql(<<<'SQL'
            INSERT INTO audit_entries (id, occurred_at, actor_type, actor_id, actor_label, subject_type, subject_id, action, changes, ip, correlation_id)
            SELECT gen_random_uuid(), now() AT TIME ZONE 'UTC', 'system', NULL, NULL, 'Role', mr.role_id, 'role.deleted',
                   json_build_object('name', json_build_array(mr.was, NULL)),
                   NULL, NULL
            FROM   moved_roles mr
            SQL);
        $this->addSql('DELETE FROM roles r USING moved_roles mr WHERE mr.role_id = r.id');
        $this->addSql('DROP TABLE moved_roles');

        $this->addSql('DROP INDEX uniq_role_name_per_organisation');
        $this->addSql('ALTER TABLE roles DROP name');
        $this->addSql('ALTER TABLE roles DROP permissions');
        $this->addSql('ALTER TABLE roles ALTER seeded_as SET NOT NULL');
        $this->addSql('ALTER TABLE roles ALTER seeded_as DROP DEFAULT');
    }

    public function down(Schema $schema): void
    {
        $this->throwIrreversibleMigrationException('The roles that were removed, and what each held, are not kept.');
    }
}
