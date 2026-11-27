<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261120150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An audit log export left preparing is tried again (sc-76259): its tries, when a try was last seen working, and the zone its dates were read in. An export already preparing counts that try as its first, last working when the row last changed, and takes its asker\'s zone today, the nearest to the one they had.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE audit_exports
              ADD attempts  SMALLINT DEFAULT 0 NOT NULL,
              ADD worked_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
              ADD zone      VARCHAR(64) DEFAULT NULL
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE audit_exports e
            SET    zone = COALESCE(u.timezone, 'UTC')
            FROM   users u
            WHERE  u.id = e.asked_by_id
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE audit_exports
            SET    attempts = 1, worked_at = updated_at
            WHERE  status = 'preparing'
            SQL);
        $this->addSql('ALTER TABLE audit_exports ALTER zone SET NOT NULL');
        $this->addSql("CREATE INDEX idx_audit_export_preparing ON audit_exports (status) WHERE (status = 'preparing')");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_audit_export_preparing');
        $this->addSql(<<<'SQL'
            ALTER TABLE audit_exports
              DROP attempts,
              DROP worked_at,
              DROP zone
            SQL);
    }
}
