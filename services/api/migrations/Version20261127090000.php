<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261127090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'When each item on a plate was marked, a variant that is not one of its items, and when an item was first marked Preparing, so a kitchen station knows when a tray is here and when an item is Held up (sc-4015).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE service_plates
                ADD marked_at JSON DEFAULT '{}' NOT NULL,
                ADD variant   VARCHAR(240) DEFAULT NULL
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE service_items
                ADD preparing_since TIMESTAMP(3) WITHOUT TIME ZONE DEFAULT NULL
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE service_items
               SET preparing_since = changed_at
             WHERE state = 'preparing'
            SQL);
        $this->addSql('ALTER TABLE service_plates ALTER marked_at DROP DEFAULT');
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE service_plates
                DROP marked_at,
                DROP variant
            SQL);
        $this->addSql('ALTER TABLE service_items DROP preparing_since');
    }
}
