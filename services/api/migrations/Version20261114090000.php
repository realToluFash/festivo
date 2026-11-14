<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261114090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A companion the guest marked Not coming, and a companion name the guest gave (sc-3779). Every companion so far is coming and named by the host, so the defaults are the backfill.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests ADD not_coming_by_guest BOOLEAN DEFAULT false NOT NULL');
        $this->addSql('ALTER TABLE guests ADD named_by_guest BOOLEAN DEFAULT false NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests DROP not_coming_by_guest');
        $this->addSql('ALTER TABLE guests DROP named_by_guest');
    }
}
