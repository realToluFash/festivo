<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261114190000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'The many-guest removal a removed guest went in (sc-3776), so one Undo and one erasure take the whole action. Every guest removed so far went alone, so nothing is backfilled.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests ADD removal_id UUID DEFAULT NULL');
        $this->addSql('CREATE INDEX idx_guests_removal ON guests (removal_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_guests_removal');
        $this->addSql('ALTER TABLE guests DROP removal_id');
    }
}
