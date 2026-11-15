<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261116110000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'When a schedule item was marked started and done, in UTC, beside its planned start, which they never change (sc-1404).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE schedule_items
                ADD started_at  TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                ADD ended_at    TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE schedule_items
                DROP started_at,
                DROP ended_at
            SQL);
    }
}
