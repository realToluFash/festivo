<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261128090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'What each payment reminder named, in its order (sc-1331): its link opens Due now on those payments. A row keeps the payment\'s id without a foreign key, and its vendor, description and amount, so a payment removed since still reads "No longer on the schedule".';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE payment_reminder_sends (
                id       UUID NOT NULL,
                sent_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE payment_reminder_send_rows (
                send_id      UUID NOT NULL,
                position     INT NOT NULL,
                payment_id   UUID NOT NULL,
                event_id     UUID NOT NULL,
                vendor_name  VARCHAR(400) NOT NULL,
                description  VARCHAR(400) NOT NULL,
                amount_minor BIGINT NOT NULL,
                PRIMARY KEY (send_id, position)
            )
            SQL);
        $this->addSql('CREATE INDEX IDX_9B2F1E5D2F2D4D0B ON payment_reminder_send_rows (send_id)');
        $this->addSql('CREATE INDEX idx_payment_reminder_send_row_event ON payment_reminder_send_rows (event_id)');
        $this->addSql('ALTER TABLE payment_reminder_send_rows ADD CONSTRAINT FK_9B2F1E5D2F2D4D0B FOREIGN KEY (send_id) REFERENCES payment_reminder_sends (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE payment_reminder_send_rows ADD CONSTRAINT FK_9B2F1E5D71F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE payment_reminder_send_rows');
        $this->addSql('DROP TABLE payment_reminder_sends');
    }
}
