<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261029120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A bell item keeps the Muted mark it was delivered with (sc-3980).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE notification_items ADD muted BOOLEAN DEFAULT false NOT NULL');
        $this->addSql(<<<'SQL'
            UPDATE notification_items i
            SET    muted = TRUE
            WHERE  i.category NOT IN ('event_day', 'account_security')
              AND  EXISTS (SELECT 1 FROM event_mutes m WHERE m.event_id = i.event_id AND m.user_id = i.user_id)
            SQL);
        $this->addSql('ALTER TABLE notification_items ALTER muted DROP DEFAULT');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE notification_items DROP muted');
    }
}
