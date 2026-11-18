<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261118200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Budget lines (sc-83): an event\'s costs, each a rate on a basis or a fixed amount, with at most one staff-time line per event. A new table, so no row predates it.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE budget_lines (
                id          UUID NOT NULL,
                event_id    UUID NOT NULL,
                label       VARCHAR(400) NOT NULL,
                category    VARCHAR(16) NOT NULL,
                basis       VARCHAR(16) NOT NULL,
                price_minor BIGINT DEFAULT NULL,
                note        TEXT DEFAULT NULL,
                created_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id),
                CONSTRAINT budget_lines_basis CHECK (basis IN ('per_head', 'per_table', 'per_staff_hour', 'per_day', 'fixed')),
                CONSTRAINT budget_lines_category CHECK (category IN ('catering', 'venue', 'flowers', 'photography', 'music', 'transport', 'staffing', 'hire', 'other')),
                CONSTRAINT budget_lines_price_on_priced_basis CHECK ((basis = 'per_staff_hour') = (price_minor IS NULL)),
                CONSTRAINT budget_lines_price_not_negative CHECK (price_minor >= 0)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_budget_line_event ON budget_lines (event_id)');
        $this->addSql("CREATE UNIQUE INDEX uniq_budget_staff_line ON budget_lines (event_id) WHERE (basis = 'per_staff_hour')");
        $this->addSql('ALTER TABLE budget_lines ADD CONSTRAINT FK_BUDGET_LINES_EVENT FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE budget_lines');
    }
}
