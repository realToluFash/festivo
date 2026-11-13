<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261113200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'The host\'s arrival note, which every guest reads under the address (sc-24385). An event made before it has none, so nothing is backfilled.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE events ADD arrival_note TEXT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE events DROP arrival_note');
    }
}
