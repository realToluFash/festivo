<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261119230000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Quotes and payment schedules (sc-87): a vendor engaged for an event, its quotes current and earlier, its scheduled payments, and the budget lines its current quote agrees. New tables and a new nullable column, so no row predates them.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE vendor_engagements (
                id          UUID NOT NULL,
                event_id    UUID NOT NULL,
                vendor_id   UUID NOT NULL,
                created_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_vendor_engagement ON vendor_engagements (event_id, vendor_id)');
        $this->addSql('CREATE INDEX idx_vendor_engagement_vendor ON vendor_engagements (vendor_id)');
        $this->addSql('ALTER TABLE vendor_engagements ADD CONSTRAINT FK_VENDOR_ENGAGEMENTS_EVENT FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE vendor_engagements ADD CONSTRAINT FK_VENDOR_ENGAGEMENTS_VENDOR FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE quotes (
                id             UUID NOT NULL,
                engagement_id  UUID NOT NULL,
                covers         VARCHAR(2000) NOT NULL,
                amount_minor   BIGINT NOT NULL,
                quoted_on      DATE NOT NULL,
                reference      VARCHAR(256) DEFAULT NULL,
                superseded_at  TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id),
                CONSTRAINT quotes_amount_positive CHECK (amount_minor > 0)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_quote_engagement ON quotes (engagement_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_current_quote ON quotes (engagement_id) WHERE (superseded_at IS NULL)');
        $this->addSql('ALTER TABLE quotes ADD CONSTRAINT FK_QUOTES_ENGAGEMENT FOREIGN KEY (engagement_id) REFERENCES vendor_engagements (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE scheduled_payments (
                id             UUID NOT NULL,
                engagement_id  UUID NOT NULL,
                description    VARCHAR(400) NOT NULL,
                amount_minor   BIGINT NOT NULL,
                due_on         DATE NOT NULL,
                created_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id),
                CONSTRAINT scheduled_payments_amount_positive CHECK (amount_minor > 0)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_scheduled_payment_engagement ON scheduled_payments (engagement_id)');
        $this->addSql('ALTER TABLE scheduled_payments ADD CONSTRAINT FK_SCHEDULED_PAYMENTS_ENGAGEMENT FOREIGN KEY (engagement_id) REFERENCES vendor_engagements (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql('ALTER TABLE budget_lines ADD agreed_in_id UUID DEFAULT NULL');
        $this->addSql('CREATE INDEX idx_budget_line_agreed_in ON budget_lines (agreed_in_id)');
        $this->addSql('ALTER TABLE budget_lines ADD CONSTRAINT FK_BUDGET_LINES_AGREED_IN FOREIGN KEY (agreed_in_id) REFERENCES vendor_engagements (id) ON DELETE SET NULL NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE budget_lines DROP CONSTRAINT FK_BUDGET_LINES_AGREED_IN');
        $this->addSql('DROP INDEX idx_budget_line_agreed_in');
        $this->addSql('ALTER TABLE budget_lines DROP agreed_in_id');
        $this->addSql('DROP TABLE scheduled_payments');
        $this->addSql('DROP TABLE quotes');
        $this->addSql('DROP TABLE vendor_engagements');
    }
}
