<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261118150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Export all data (sc-612): each archive an Owner asks for, its tries, and its one download. No organisation has one before this.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE organisation_exports (
                id               UUID NOT NULL,
                organisation_id  UUID NOT NULL,
                asked_by_id      UUID NOT NULL,
                asked_at         TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                status           VARCHAR(20) NOT NULL,
                attempts         SMALLINT DEFAULT 0 NOT NULL,
                attempted_at     TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                archive_key      VARCHAR(255) DEFAULT NULL,
                ready_at         TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                downloaded_at    TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_organisation_export_organisation ON organisation_exports (organisation_id, asked_at)');
        $this->addSql('CREATE INDEX idx_organisation_export_asked_by ON organisation_exports (asked_by_id)');
        $this->addSql("CREATE INDEX idx_organisation_export_preparing ON organisation_exports (status) WHERE (status = 'preparing')");
        $this->addSql('CREATE INDEX IDX_8FAA63439E6B1585 ON organisation_exports (organisation_id)');
        $this->addSql('ALTER TABLE organisation_exports ADD CONSTRAINT FK_8FAA63439E6B1585 FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE organisation_exports ADD CONSTRAINT FK_8FAA63434F7A72E4 FOREIGN KEY (asked_by_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE organisation_exports');
    }
}
