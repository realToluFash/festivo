<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261019200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An organisation can be deleted and held for support to restore until 30 × 24 hours after, with who deleted it.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE organisations
                ADD deleted_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                ADD deleted_by UUID DEFAULT NULL
            SQL);
        $this->addSql('CREATE INDEX idx_organisation_deleted ON organisations (deleted_at)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_organisation_deleted');
        $this->addSql(<<<'SQL'
            ALTER TABLE organisations
                DROP deleted_at,
                DROP deleted_by
            SQL);
    }
}
