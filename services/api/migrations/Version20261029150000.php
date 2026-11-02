<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261029150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'What changed about an event for its members to hear, and a bell item that one thread keeps updating while it is unread (sc-13214).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE event_changes (
                id               UUID NOT NULL,
                event_id         UUID NOT NULL,
                actor_id         UUID DEFAULT NULL,
                actor_name       VARCHAR(255) DEFAULT NULL,
                kind             VARCHAR(20) NOT NULL,
                fields           JSONB NOT NULL,
                event_day        BOOLEAN NOT NULL,
                restorable_until TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_event_change_event ON event_changes (event_id, id)');
        $this->addSql('CREATE INDEX IDX_A577119271F7E88B ON event_changes (event_id)');
        $this->addSql('CREATE INDEX IDX_A577119210DAF24A ON event_changes (actor_id)');
        $this->addSql('ALTER TABLE event_changes ADD CONSTRAINT FK_A577119271F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE event_changes ADD CONSTRAINT FK_A577119210DAF24A FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');

        $this->addSql('ALTER TABLE notification_items ADD thread VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE notification_items ADD thread_from VARCHAR(255) DEFAULT NULL');
        $this->addSql('CREATE UNIQUE INDEX uniq_notification_item_unread_thread ON notification_items (user_id, thread) WHERE ((read_at IS NULL) AND (thread IS NOT NULL))');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX uniq_notification_item_unread_thread');
        $this->addSql('ALTER TABLE notification_items DROP thread_from');
        $this->addSql('ALTER TABLE notification_items DROP thread');
        $this->addSql('DROP TABLE event_changes');
    }
}
