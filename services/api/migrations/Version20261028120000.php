<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261028120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return "The bell's items, each member's Push and Email switches, and Mute this event (sc-3980).";
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE notification_items (
                id          UUID NOT NULL,
                user_id     UUID NOT NULL,
                category    VARCHAR(30) NOT NULL,
                title       TEXT NOT NULL,
                lines       JSON NOT NULL,
                event_id    UUID DEFAULT NULL,
                event_name  VARCHAR(255) DEFAULT NULL,
                place       VARCHAR(500) DEFAULT NULL,
                read_at     TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_notification_item_feed ON notification_items (user_id, created_at)');
        $this->addSql('CREATE INDEX idx_notification_item_unread ON notification_items (user_id) WHERE (read_at IS NULL)');
        $this->addSql('CREATE INDEX idx_notification_item_created ON notification_items (created_at)');
        $this->addSql('CREATE INDEX IDX_27AA0CB4A76ED395 ON notification_items (user_id)');
        $this->addSql('ALTER TABLE notification_items ADD CONSTRAINT FK_27AA0CB4A76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE notification_preferences (
                id        UUID NOT NULL,
                user_id   UUID NOT NULL,
                category  VARCHAR(30) NOT NULL,
                channel   VARCHAR(10) NOT NULL,
                allowed   BOOLEAN NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_notification_preference ON notification_preferences (user_id, category, channel)');
        $this->addSql('CREATE INDEX IDX_3CAA95B4A76ED395 ON notification_preferences (user_id)');
        $this->addSql('ALTER TABLE notification_preferences ADD CONSTRAINT FK_3CAA95B4A76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE event_mutes (
                id        UUID NOT NULL,
                user_id   UUID NOT NULL,
                event_id  UUID NOT NULL,
                muted_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_event_mute ON event_mutes (user_id, event_id)');
        $this->addSql('CREATE INDEX idx_event_mute_event ON event_mutes (event_id)');
        $this->addSql('CREATE INDEX IDX_3804DA8BA76ED395 ON event_mutes (user_id)');
        $this->addSql('ALTER TABLE event_mutes ADD CONSTRAINT FK_3804DA8BA76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE event_mutes ADD CONSTRAINT FK_3804DA8B71F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE event_mutes');
        $this->addSql('DROP TABLE notification_preferences');
        $this->addSql('DROP TABLE notification_items');
    }
}
