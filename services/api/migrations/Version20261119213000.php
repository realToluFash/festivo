<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261119213000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'The audit log (sc-611): each entry keeps the organisation and event it is about, the name of what it was done to and the device, filled in for the entries already kept; and the exports prepared in the background.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE audit_entries
                ADD organisation_id UUID DEFAULT NULL,
                ADD event_id        UUID DEFAULT NULL,
                ADD event_name      VARCHAR(240) DEFAULT NULL,
                ADD target          VARCHAR(720) DEFAULT NULL,
                ADD user_agent      VARCHAR(512) DEFAULT NULL
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE audit_entries a
            SET    organisation_id = o.id,
                   target          = o.name
            FROM   organisations o
            WHERE  a.subject_type = 'Organisation'
              AND  o.id = a.subject_id
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE audit_entries
            SET    organisation_id = subject_id
            WHERE  subject_type = 'Organisation'
              AND  organisation_id IS NULL
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE audit_entries a
            SET    organisation_id = m.organisation_id,
                   target          = u.name
            FROM   memberships m
            JOIN   users u ON u.id = m.user_id
            WHERE  a.subject_type = 'Membership'
              AND  m.id = a.subject_id
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE audit_entries a
            SET    organisation_id = i.organisation_id,
                   target          = i.email
            FROM   invitations i
            WHERE  a.subject_type = 'Invitation'
              AND  i.id = a.subject_id
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE audit_entries a
            SET    organisation_id = c.organisation_id,
                   target          = u.name
            FROM   owner_claims c
            JOIN   users u ON u.id = c.claimant_id
            WHERE  a.subject_type = 'OwnerClaim'
              AND  c.id = a.subject_id
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE audit_entries a
            SET    organisation_id = e.organisation_id,
                   event_id        = e.id,
                   event_name      = e.name,
                   target          = e.name
            FROM   events e
            WHERE  a.subject_type = 'Event'
              AND  e.id = a.subject_id
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE audit_entries a
            SET    organisation_id = e.organisation_id,
                   event_id        = e.id,
                   event_name      = e.name,
                   target          = COALESCE(u.name, p.address)
            FROM   event_people p
            JOIN   events e ON e.id = p.event_id
            LEFT JOIN users u ON u.id = p.user_id
            WHERE  a.subject_type = 'EventPerson'
              AND  p.id = a.subject_id
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE audit_entries a
            SET    organisation_id = e.organisation_id,
                   event_id        = e.id,
                   event_name      = e.name,
                   target          = u.name
            FROM   events e, memberships m
            JOIN   users u ON u.id = m.user_id
            WHERE  a.subject_type = 'EventPerson'
              AND  a.organisation_id IS NULL
              AND  e.id::text = a.changes -> 'eventId' ->> 1
              AND  m.id::text = a.changes -> 'membershipId' ->> 1
            SQL);
        $this->addSql('CREATE INDEX idx_audit_organisation ON audit_entries (organisation_id, occurred_at)');
        $this->addSql(<<<'SQL'
            CREATE TABLE audit_exports (
                id               UUID NOT NULL,
                organisation_id  UUID NOT NULL,
                asked_by_id      UUID NOT NULL,
                asked_at         TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                format           VARCHAR(8) NOT NULL,
                filters          JSON NOT NULL,
                entries          INT NOT NULL,
                locale           VARCHAR(20) NOT NULL,
                status           VARCHAR(20) NOT NULL,
                file_key         VARCHAR(255) DEFAULT NULL,
                ready_at         TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_audit_export_organisation ON audit_exports (organisation_id, asked_at)');
        $this->addSql('CREATE INDEX idx_audit_export_asked_by ON audit_exports (asked_by_id)');
        $this->addSql('ALTER TABLE audit_exports ADD CONSTRAINT FK_AUDIT_EXPORT_ORGANISATION FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE audit_exports ADD CONSTRAINT FK_AUDIT_EXPORT_ASKED_BY FOREIGN KEY (asked_by_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE audit_exports');
        $this->addSql('DROP INDEX idx_audit_organisation');
        $this->addSql(<<<'SQL'
            ALTER TABLE audit_entries
                DROP organisation_id,
                DROP event_id,
                DROP event_name,
                DROP target,
                DROP user_agent
            SQL);
    }
}
