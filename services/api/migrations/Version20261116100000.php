<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261116100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An event\'s running order: each item a wall-clock start in the event\'s zone, a length, a place and an owner (sc-3893). No event has one yet.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE schedule_items (
                id              UUID NOT NULL,
                event_id        UUID NOT NULL,
                title           VARCHAR(120) NOT NULL,
                starts_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                length_minutes  SMALLINT DEFAULT NULL,
                place           VARCHAR(60) DEFAULT NULL,
                owner_name      VARCHAR(120) DEFAULT NULL,
                owner_role      VARCHAR(40) DEFAULT NULL,
                note            VARCHAR(500) DEFAULT NULL,
                fixed_time      BOOLEAN DEFAULT false NOT NULL,
                show_to_guests  BOOLEAN DEFAULT false NOT NULL,
                changed_by_id   UUID DEFAULT NULL,
                version         INT DEFAULT 1 NOT NULL,
                created_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_schedule_item_start ON schedule_items (event_id, starts_at)');
        $this->addSql('CREATE INDEX IDX_1D47291171F7E88B ON schedule_items (event_id)');
        $this->addSql('CREATE INDEX IDX_1D472911828AD0A0 ON schedule_items (changed_by_id)');
        $this->addSql('ALTER TABLE schedule_items ADD CONSTRAINT FK_1D47291171F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE schedule_items ADD CONSTRAINT FK_1D472911828AD0A0 FOREIGN KEY (changed_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE schedule_items');
    }
}
