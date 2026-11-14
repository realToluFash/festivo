<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261027090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An event is paused and resumed, keeping everything (sc-3586).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE events ADD paused_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE events DROP paused_at');
    }
}
