<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261026210000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An event is deleted softly, restorable by support for 30 days, then purged (sc-3592).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE events
                ADD deleted_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                ADD deleted_by UUID DEFAULT NULL
            SQL);
        $this->addSql('CREATE INDEX idx_event_deleted ON events (deleted_at)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_event_deleted');
        $this->addSql(<<<'SQL'
            ALTER TABLE events
                DROP deleted_at,
                DROP deleted_by
            SQL);
    }
}
