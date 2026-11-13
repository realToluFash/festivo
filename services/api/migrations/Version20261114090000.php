<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261114090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'The hosts\' thank-you on a Finished event, shown on every guest\'s page (sc-6476). On the event\'s row, so a deletion hides it, a restore brings it back and the purge removes it.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE events ADD thank_you VARCHAR(280) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE events DROP thank_you');
    }
}
