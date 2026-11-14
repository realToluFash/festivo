<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261114150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'When a guest\'s needs were last changed, and whether by the guest on their own page (sc-3778). Needs were first recorded today, so nothing is backfilled.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE guests
                ADD needs_changed_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                ADD needs_changed_by_guest BOOLEAN DEFAULT false NOT NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE guests
                DROP needs_changed_at,
                DROP needs_changed_by_guest
            SQL);
    }
}
