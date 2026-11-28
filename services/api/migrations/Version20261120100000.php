<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261120100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Marking a scheduled payment paid, cancelling it, and adding one already made (sc-88). Nullable columns and a false default, so every existing payment reads as unpaid and owed, as it was.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE scheduled_payments
                ADD paid_amount_minor  BIGINT DEFAULT NULL,
                ADD paid_on            DATE DEFAULT NULL,
                ADD paid_reference     VARCHAR(400) DEFAULT NULL,
                ADD paid_at            TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                ADD paid_by_id         UUID DEFAULT NULL,
                ADD added_as_paid      BOOLEAN DEFAULT false NOT NULL,
                ADD cancelled_at       TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                ADD cancelled_by_id    UUID DEFAULT NULL,
                ADD cancel_reason      VARCHAR(800) DEFAULT NULL,
                ADD CONSTRAINT scheduled_payments_paid_amount_positive CHECK (paid_amount_minor > 0),
                ADD CONSTRAINT scheduled_payments_paid_or_cancelled CHECK (paid_at IS NULL OR cancelled_at IS NULL)
            SQL);
        $this->addSql('CREATE INDEX idx_scheduled_payment_paid_by ON scheduled_payments (paid_by_id)');
        $this->addSql('CREATE INDEX idx_scheduled_payment_cancelled_by ON scheduled_payments (cancelled_by_id)');
        $this->addSql('ALTER TABLE scheduled_payments ADD CONSTRAINT FK_SCHEDULED_PAYMENTS_PAID_BY FOREIGN KEY (paid_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE scheduled_payments ADD CONSTRAINT FK_SCHEDULED_PAYMENTS_CANCELLED_BY FOREIGN KEY (cancelled_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE scheduled_payments DROP CONSTRAINT FK_SCHEDULED_PAYMENTS_CANCELLED_BY');
        $this->addSql('ALTER TABLE scheduled_payments DROP CONSTRAINT FK_SCHEDULED_PAYMENTS_PAID_BY');
        $this->addSql('DROP INDEX idx_scheduled_payment_cancelled_by');
        $this->addSql('DROP INDEX idx_scheduled_payment_paid_by');
        $this->addSql(<<<'SQL'
            ALTER TABLE scheduled_payments
                DROP CONSTRAINT scheduled_payments_paid_or_cancelled,
                DROP CONSTRAINT scheduled_payments_paid_amount_positive,
                DROP paid_amount_minor,
                DROP paid_on,
                DROP paid_reference,
                DROP paid_at,
                DROP paid_by_id,
                DROP added_as_paid,
                DROP cancelled_at,
                DROP cancelled_by_id,
                DROP cancel_reason
            SQL);
    }
}
