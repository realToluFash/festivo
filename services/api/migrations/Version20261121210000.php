<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261121210000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A host\'s message to guests (sc-3942): the message and the conversation it follows up, the address each email delivery went to and why one was not sent, and a guest\'s address marked bouncing. No delivery predates the columns.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE guest_messages (
                id                        UUID NOT NULL,
                event_id                  UUID NOT NULL,
                audience                  VARCHAR(10) NOT NULL,
                chosen_guest_ids          JSONB NOT NULL,
                subject                   VARCHAR(600) DEFAULT NULL,
                body                      TEXT NOT NULL,
                created_by_id             UUID DEFAULT NULL,
                created_by_name           VARCHAR(255) NOT NULL,
                scheduled_notification_id UUID NOT NULL,
                created_at                TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                follows_id                UUID DEFAULT NULL,
                PRIMARY KEY (id),
                CONSTRAINT chk_guest_message_audience CHECK (audience IN ('all', 'chosen'))
            )
            SQL);
        $this->addSql('CREATE INDEX idx_guest_message_event ON guest_messages (event_id, created_at)');
        $this->addSql('CREATE INDEX IDX_GUEST_MESSAGE_CREATED_BY ON guest_messages (created_by_id)');
        $this->addSql('CREATE INDEX IDX_GUEST_MESSAGE_FOLLOWS ON guest_messages (follows_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_guest_message_scheduled ON guest_messages (scheduled_notification_id)');
        $this->addSql('ALTER TABLE guest_messages ADD CONSTRAINT FK_GUEST_MESSAGE_EVENT FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE guest_messages ADD CONSTRAINT FK_GUEST_MESSAGE_CREATED_BY FOREIGN KEY (created_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE guest_messages ADD CONSTRAINT FK_GUEST_MESSAGE_FOLLOWS FOREIGN KEY (follows_id) REFERENCES guest_messages (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE guest_messages ADD CONSTRAINT FK_GUEST_MESSAGE_SCHEDULED FOREIGN KEY (scheduled_notification_id) REFERENCES scheduled_notifications (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql('ALTER TABLE notification_deliveries ADD address VARCHAR(254) DEFAULT NULL');
        $this->addSql('ALTER TABLE notification_deliveries ADD not_sent_reason VARCHAR(20) DEFAULT NULL');
        $this->addSql('ALTER TABLE notification_deliveries ADD provider_code VARCHAR(16) DEFAULT NULL');

        $this->addSql('ALTER TABLE guests ADD email_bouncing_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests DROP email_bouncing_at');
        $this->addSql('ALTER TABLE notification_deliveries DROP provider_code');
        $this->addSql('ALTER TABLE notification_deliveries DROP not_sent_reason');
        $this->addSql('ALTER TABLE notification_deliveries DROP address');
        $this->addSql('DROP TABLE guest_messages');
    }
}
