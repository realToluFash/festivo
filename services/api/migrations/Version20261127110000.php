<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261127110000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'What each person on the staff was last told of their shifts, job, date and venue, so a change notice says only what differs, and each event\'s Reminder the day before switch (sc-4333).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE staff_members ADD told JSON DEFAULT NULL');
        $this->addSql('ALTER TABLE events ADD staff_reminder BOOLEAN DEFAULT true NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE events DROP staff_reminder');
        $this->addSql('ALTER TABLE staff_members DROP told');
    }
}
