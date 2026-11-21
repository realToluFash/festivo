<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261113220000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A guest calendar\'s SEQUENCE and DTSTAMP, moved only when its name, time, venue, call-off or deletion changes (sc-3627). Nobody has subscribed yet, so nothing is backfilled.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE events ADD calendar_sequence INT DEFAULT 0 NOT NULL');
        $this->addSql('ALTER TABLE events ADD calendar_changed_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE events DROP calendar_sequence');
        $this->addSql('ALTER TABLE events DROP calendar_changed_at');
    }
}
