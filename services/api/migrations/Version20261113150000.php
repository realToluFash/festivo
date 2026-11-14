<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261113150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A guest\'s version, the ETag an edit is checked against so it never overwrites a colleague\'s change (sc-3773). Every guest so far starts at 1.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests ADD version INT DEFAULT 1 NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests DROP version');
    }
}
