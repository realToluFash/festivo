<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261115180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Who recorded a reply a host gave for a guest, and how the guest told them (sc-3787). Every reply before it was the guest\'s own, so nothing is backfilled.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE guests
                ADD reply_recorded_by  VARCHAR(255) DEFAULT NULL,
                ADD reply_recorded_how VARCHAR(16)  DEFAULT NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE guests
                DROP reply_recorded_by,
                DROP reply_recorded_how
            SQL);
    }
}
