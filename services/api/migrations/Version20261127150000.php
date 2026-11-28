<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261127150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Where each organisation\'s metered use stands against 80% and 100% of its included amount, and when it was last warned (sc-3931).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE usage_warnings (
                organisation_id     UUID NOT NULL,
                kind                VARCHAR(20) NOT NULL,
                threshold           SMALLINT NOT NULL,
                above               BOOLEAN NOT NULL,
                warned_period_start TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                PRIMARY KEY (organisation_id, kind, threshold)
            )
            SQL);
        $this->addSql('CREATE INDEX IDX_E41F6F919E6B1585 ON usage_warnings (organisation_id)');
        $this->addSql(<<<'SQL'
            ALTER TABLE usage_warnings
                ADD CONSTRAINT FK_E41F6F919E6B1585 FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE usage_warnings');
    }
}
