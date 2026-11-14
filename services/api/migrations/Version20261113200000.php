<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261113200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Account and security email on the notification path (sc-4332): the provider\'s report on each delivery, the suppressed addresses, and an invitation\'s send read from its delivery record. An invitation sent before this reads its sentAt as its createdAt, which it already fell back to. The "already registered" email\'s hourly limit moves to the worker.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE email_suppressions (
                address        VARCHAR(320) NOT NULL,
                reason         VARCHAR(20) NOT NULL,
                suppressed_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (address)
            )
            SQL);
        $this->addSql('ALTER TABLE notification_deliveries ADD provider_report VARCHAR(20) DEFAULT NULL');
        $this->addSql('ALTER TABLE notification_deliveries ADD provider_reported_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        // InvitationDeliveries reads an invitation's sends by the part of the source before the colon, which no column index can serve.
        $this->addSql("CREATE INDEX idx_notification_delivery_invitation ON notification_deliveries (type, split_part(source_id, ':', 1))");
        $this->addSql('ALTER TABLE invitations DROP delivery');
        $this->addSql('ALTER TABLE invitations DROP sent_at');
        $this->addSql('ALTER TABLE pending_registrations DROP already_registered_emailed_at');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE email_suppressions');
        $this->addSql('DROP INDEX idx_notification_delivery_invitation');
        $this->addSql('ALTER TABLE notification_deliveries DROP provider_report');
        $this->addSql('ALTER TABLE notification_deliveries DROP provider_reported_at');
        $this->addSql("ALTER TABLE invitations ADD delivery VARCHAR(20) DEFAULT 'queued' NOT NULL");
        $this->addSql('ALTER TABLE invitations ADD sent_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE pending_registrations ADD already_registered_emailed_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
    }
}
