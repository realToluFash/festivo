<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261026190000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'The one notification clock and its outbox (sc-104): what is due, for whom, and each delivery per person per channel.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE scheduled_notifications (
                id                UUID NOT NULL,
                type              VARCHAR(80) NOT NULL,
                cancellation_key  VARCHAR(255) NOT NULL,
                source_id         VARCHAR(255) NOT NULL,
                event_id          UUID DEFAULT NULL,
                trigger           JSONB NOT NULL,
                due_at            TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                send_by           TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                audience          JSONB NOT NULL,
                payload           JSONB NOT NULL,
                priority          SMALLINT NOT NULL,
                status            VARCHAR(20) NOT NULL,
                fanned_out_after  VARCHAR(255) DEFAULT NULL,
                claimed_at        TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                claimed_until     TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                outcome           TEXT DEFAULT NULL,
                created_at        TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                finished_at       TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql("CREATE INDEX idx_scheduled_notification_due ON scheduled_notifications (priority, due_at) WHERE ((status)::text = 'pending'::text)");
        $this->addSql('CREATE INDEX idx_scheduled_notification_event ON scheduled_notifications (event_id)');
        $this->addSql("CREATE UNIQUE INDEX uniq_scheduled_notification_pending_key ON scheduled_notifications (cancellation_key) WHERE ((status)::text = 'pending'::text)");
        $this->addSql('ALTER TABLE scheduled_notifications ADD CONSTRAINT FK_E7DE778171F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE notification_deliveries (
                id                         UUID NOT NULL,
                scheduled_notification_id  UUID NOT NULL,
                event_id                   UUID DEFAULT NULL,
                type                       VARCHAR(80) NOT NULL,
                source_id                  VARCHAR(255) NOT NULL,
                recipient_kind             VARCHAR(10) NOT NULL,
                recipient_id               UUID NOT NULL,
                channel                    VARCHAR(10) NOT NULL,
                priority                   SMALLINT NOT NULL,
                collapse_key               VARCHAR(255) DEFAULT NULL,
                status                     VARCHAR(20) NOT NULL,
                due_at                     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                next_attempt_at            TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                send_by                    TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                attempts                   INT DEFAULT 0 NOT NULL,
                held                       VARCHAR(20) DEFAULT NULL,
                claimed_at                 TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                claimed_until              TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                finished_at                TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                last_error                 TEXT DEFAULT NULL,
                collapsed_into             UUID DEFAULT NULL,
                provider_message_id        VARCHAR(255) DEFAULT NULL,
                created_at                 TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql("CREATE INDEX idx_notification_delivery_next ON notification_deliveries (priority, next_attempt_at) WHERE ((status)::text = 'pending'::text)");
        $this->addSql('CREATE INDEX idx_notification_delivery_finished ON notification_deliveries (finished_at)');
        $this->addSql('CREATE INDEX idx_notification_delivery_scheduled ON notification_deliveries (scheduled_notification_id)');
        $this->addSql('CREATE INDEX idx_notification_delivery_event ON notification_deliveries (event_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_notification_delivery_idempotency ON notification_deliveries (type, source_id, recipient_kind, recipient_id, channel)');
        $this->addSql('ALTER TABLE notification_deliveries ADD CONSTRAINT FK_9475204A6297729F FOREIGN KEY (scheduled_notification_id) REFERENCES scheduled_notifications (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE notification_deliveries ADD CONSTRAINT FK_9475204A71F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE notification_deliveries');
        $this->addSql('DROP TABLE scheduled_notifications');
    }
}
