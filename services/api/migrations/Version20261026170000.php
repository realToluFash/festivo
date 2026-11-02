<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261026170000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An event records when it was made live (sc-3584). Every event so far is a Draft, so none has.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE events ADD made_live_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE events DROP made_live_at
            SQL);
    }
}
