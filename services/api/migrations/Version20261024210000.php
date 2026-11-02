<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261024210000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An event carries a version, its ETag, so two organisers editing at once cannot overwrite each other (sc-3587). Every event so far starts at 1.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE events ADD version INT DEFAULT 1 NOT NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE events DROP version
            SQL);
    }
}
