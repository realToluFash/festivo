<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261125230000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Who gets it (sc-3957): a deleted group keeps its row so a condition can still name it, a message keeps its own copy of its conditions, and an event keeps up to 20 saved audiences.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guest_groups ADD deleted_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('DROP INDEX uniq_guest_group_name');
        $this->addSql('CREATE UNIQUE INDEX uniq_guest_group_name ON guest_groups (event_id, name_key) WHERE (deleted_at IS NULL)');
        $this->addSql('ALTER TABLE guest_messages ADD conditions JSONB DEFAULT NULL');
        $this->addSql('ALTER TABLE guest_messages DROP CONSTRAINT chk_guest_message_audience');
        $this->addSql(<<<'SQL'
            ALTER TABLE guest_messages ADD CONSTRAINT chk_guest_message_audience CHECK (
                (audience IN ('all', 'chosen') AND conditions IS NULL)
                OR (audience = 'conditions' AND conditions IS NOT NULL)
            )
            SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE saved_audiences (
                id         UUID NOT NULL,
                event_id   UUID NOT NULL,
                name       VARCHAR(240) NOT NULL,
                name_key   VARCHAR(240) NOT NULL,
                conditions JSONB NOT NULL,
                created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_saved_audience_name ON saved_audiences (event_id, name_key)');
        $this->addSql('CREATE INDEX IDX_SAVED_AUDIENCE_EVENT ON saved_audiences (event_id)');
        $this->addSql('ALTER TABLE saved_audiences ADD CONSTRAINT FK_SAVED_AUDIENCE_EVENT FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE saved_audiences');
        $this->addSql("DELETE FROM guest_messages WHERE audience = 'conditions'");
        $this->addSql('ALTER TABLE guest_messages DROP CONSTRAINT chk_guest_message_audience');
        $this->addSql('ALTER TABLE guest_messages DROP conditions');
        $this->addSql("ALTER TABLE guest_messages ADD CONSTRAINT chk_guest_message_audience CHECK (audience IN ('all', 'chosen'))");
        $this->addSql('DELETE FROM guest_groups WHERE deleted_at IS NOT NULL');
        $this->addSql('DROP INDEX uniq_guest_group_name');
        $this->addSql('CREATE UNIQUE INDEX uniq_guest_group_name ON guest_groups (event_id, name_key)');
        $this->addSql('ALTER TABLE guest_groups DROP deleted_at');
    }
}
