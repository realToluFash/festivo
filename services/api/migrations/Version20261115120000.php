<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261115120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An event\'s Reply by and the day a save closed replies, and a guest reopened after it (sc-3780). An event made before it has no Reply by, so nothing is backfilled.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE events
                ADD reply_by          DATE DEFAULT NULL,
                ADD replies_closed_on DATE DEFAULT NULL
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE guests
                ADD replies_reopened_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                ADD replies_reopened_by VARCHAR(255) DEFAULT NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE guests
                DROP replies_reopened_at,
                DROP replies_reopened_by
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE events
                DROP reply_by,
                DROP replies_closed_on
            SQL);
    }
}
