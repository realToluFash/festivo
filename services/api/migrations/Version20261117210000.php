<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261117210000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Share tables with guests (sc-4022): one row per seating plan, when the tables were shared and the day to share them by.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE table_sharings (
                id        UUID NOT NULL,
                plan_id   UUID NOT NULL,
                shared_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                share_by  DATE DEFAULT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX UNIQ_C874895DE899029B ON table_sharings (plan_id)');
        $this->addSql('ALTER TABLE table_sharings ADD CONSTRAINT FK_C874895DE899029B FOREIGN KEY (plan_id) REFERENCES seating_plans (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE table_sharings');
    }
}
