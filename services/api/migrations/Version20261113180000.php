<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261113180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'When a guest\'s current reply was given and where, set by the guest\'s own page (sc-1439). No guest has replied yet, so nothing is backfilled.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests ADD replied_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE guests ADD reply_source VARCHAR(16) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests DROP replied_at');
        $this->addSql('ALTER TABLE guests DROP reply_source');
    }
}
