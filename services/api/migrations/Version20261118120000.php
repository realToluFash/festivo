<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261118120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Run of show on the lock screen (sc-66580): whether each night press was made from the card.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE schedule_presses ADD from_card BOOLEAN DEFAULT false NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE schedule_presses DROP from_card');
    }
}
