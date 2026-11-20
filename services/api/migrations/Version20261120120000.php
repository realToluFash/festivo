<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261120120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Who is paying (sc-91): an event\'s payers, each cost\'s split between them, and its parts. No event has a payer yet, so every cost starts at No payer yet and nothing is backfilled.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE payers (
                id         UUID NOT NULL,
                event_id   UUID NOT NULL,
                name       VARCHAR(240) NOT NULL,
                note       VARCHAR(800) DEFAULT NULL,
                removed_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_payer_event ON payers (event_id)');
        $this->addSql('ALTER TABLE payers ADD CONSTRAINT FK_PAYERS_EVENT FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE payer_parts (
                id       UUID NOT NULL,
                line_id  UUID NOT NULL,
                payer_id UUID NOT NULL,
                value    BIGINT NOT NULL,
                PRIMARY KEY (id),
                CONSTRAINT payer_parts_value_positive CHECK (value > 0)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_payer_part ON payer_parts (line_id, payer_id)');
        $this->addSql('CREATE INDEX idx_payer_part_payer ON payer_parts (payer_id)');
        $this->addSql('ALTER TABLE payer_parts ADD CONSTRAINT FK_PAYER_PARTS_LINE FOREIGN KEY (line_id) REFERENCES budget_lines (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE payer_parts ADD CONSTRAINT FK_PAYER_PARTS_PAYER FOREIGN KEY (payer_id) REFERENCES payers (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            ALTER TABLE budget_lines
                ADD payer_split   VARCHAR(16) DEFAULT NULL,
                ADD rest_payer_id UUID DEFAULT NULL
            SQL);
        $this->addSql('CREATE INDEX idx_budget_line_rest_payer ON budget_lines (rest_payer_id)');
        $this->addSql('ALTER TABLE budget_lines ADD CONSTRAINT FK_BUDGET_LINES_REST_PAYER FOREIGN KEY (rest_payer_id) REFERENCES payers (id) ON DELETE SET NULL NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE budget_lines DROP CONSTRAINT FK_BUDGET_LINES_REST_PAYER');
        $this->addSql('DROP INDEX idx_budget_line_rest_payer');
        $this->addSql(<<<'SQL'
            ALTER TABLE budget_lines
                DROP payer_split,
                DROP rest_payer_id
            SQL);
        $this->addSql('DROP TABLE payer_parts');
        $this->addSql('DROP TABLE payers');
    }
}
