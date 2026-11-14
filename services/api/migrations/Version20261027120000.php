<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261027120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An event names its hosts, in order, as its guests read them (sc-6713). Every event so far has none.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE events ADD hosts JSON DEFAULT '[]' NOT NULL");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE events DROP hosts');
    }
}
