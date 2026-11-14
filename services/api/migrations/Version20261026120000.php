<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261026120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An event has a type from a fixed list (sc-3588). Every event so far becomes `other`, and nobody is asked to fix it.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE events ADD type VARCHAR(20) DEFAULT 'other' NOT NULL
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE events ALTER type DROP DEFAULT
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE events DROP type
            SQL);
    }
}
