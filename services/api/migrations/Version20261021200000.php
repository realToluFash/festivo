<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261021200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A membership through company domain joining remembers its domain, and why and since when it is suspended (sc-564).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE memberships
                ADD COLUMN domain       VARCHAR(253) DEFAULT NULL,
                ADD COLUMN suspension   VARCHAR(30) DEFAULT NULL,
                ADD COLUMN suspended_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL
            SQL);
        $this->addSql('CREATE INDEX idx_membership_domain ON memberships (domain)');
        $this->addSql(<<<'SQL'
            UPDATE memberships m
            SET    domain = LOWER(SPLIT_PART(e.address, '@', 2))
            FROM   email_addresses e
            WHERE  e.user_id = m.user_id
              AND  e.is_primary
              AND  e.verified_at IS NOT NULL
              AND  (
                       SELECT t.channel
                       FROM   membership_transitions t
                       WHERE  t.membership_id = m.id
                         AND  t.to_status IN ('active', 'pending_approval')
                       ORDER  BY t.occurred_at DESC, t.id DESC
                       LIMIT  1
                   ) = 'domain'
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_membership_domain');
        $this->addSql(<<<'SQL'
            ALTER TABLE memberships
                DROP COLUMN domain,
                DROP COLUMN suspension,
                DROP COLUMN suspended_at
            SQL);
    }
}
