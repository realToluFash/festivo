<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261120090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'What a budget line is charged at (sc-92): a markup in tenths of a percent or an explicit client price on the line, never both, and a markup once for the event or per category. No line has either yet, so nothing is backfilled.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE budget_lines
              ADD markup_tenths      INT    DEFAULT NULL,
              ADD client_price_minor BIGINT DEFAULT NULL
            SQL);
        $this->addSql('ALTER TABLE budget_lines DROP CONSTRAINT budget_lines_erased_past_currency');
        $this->addSql(<<<'SQL'
            ALTER TABLE budget_lines
              ADD CONSTRAINT budget_lines_markup_bounds CHECK (markup_tenths BETWEEN 0 AND 9999),
              ADD CONSTRAINT budget_lines_client_price_not_negative CHECK (client_price_minor >= 0),
              ADD CONSTRAINT budget_lines_one_charge CHECK (markup_tenths IS NULL OR client_price_minor IS NULL),
              ADD CONSTRAINT budget_lines_erased_past_currency CHECK (
                  NOT currency_changed OR (removed_at IS NOT NULL AND label IS NULL AND price_minor IS NULL AND note IS NULL AND client_price_minor IS NULL)
              )
            SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE budget_markups (
                id            UUID NOT NULL,
                event_id      UUID NOT NULL,
                category      VARCHAR(16) DEFAULT NULL,
                markup_tenths INT NOT NULL,
                created_at    TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at    TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id),
                CONSTRAINT budget_markups_category CHECK (category IN ('catering', 'venue', 'flowers', 'photography', 'music', 'transport', 'staffing', 'hire', 'other')),
                CONSTRAINT budget_markups_bounds CHECK (markup_tenths BETWEEN 0 AND 9999)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_budget_markup_event ON budget_markups (event_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_budget_markup_event ON budget_markups (event_id) WHERE (category IS NULL)');
        $this->addSql('CREATE UNIQUE INDEX uniq_budget_markup_category ON budget_markups (event_id, category) WHERE (category IS NOT NULL)');
        $this->addSql('ALTER TABLE budget_markups ADD CONSTRAINT FK_BUDGET_MARKUPS_EVENT FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE budget_markups');
        $this->addSql('ALTER TABLE budget_lines DROP CONSTRAINT budget_lines_erased_past_currency');
        $this->addSql(<<<'SQL'
            ALTER TABLE budget_lines
              DROP CONSTRAINT budget_lines_one_charge,
              DROP CONSTRAINT budget_lines_client_price_not_negative,
              DROP CONSTRAINT budget_lines_markup_bounds,
              DROP markup_tenths,
              DROP client_price_minor,
              ADD CONSTRAINT budget_lines_erased_past_currency CHECK (
                  NOT currency_changed OR (removed_at IS NOT NULL AND label IS NULL AND price_minor IS NULL AND note IS NULL)
              )
            SQL);
    }
}
