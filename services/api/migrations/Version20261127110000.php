<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261127110000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Final numbers due and the copies given to the kitchen (sc-30812).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE kitchen_final_numbers (
                id       UUID    NOT NULL,
                event_id UUID    NOT NULL,
                due_on   DATE    DEFAULT NULL,
                revision INT     DEFAULT 0 NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX UNIQ_KITCHEN_FINAL_NUMBERS_EVENT ON kitchen_final_numbers (event_id)');
        $this->addSql(<<<'SQL'
            ALTER TABLE kitchen_final_numbers
                ADD CONSTRAINT FK_KITCHEN_FINAL_NUMBERS_EVENT FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE
            SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE kitchen_copies (
                id               UUID                           NOT NULL,
                event_id         UUID                           NOT NULL,
                recorded_by_id   UUID                           DEFAULT NULL,
                recorded_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                recorded_by_name VARCHAR(720)                   NOT NULL,
                names            BOOLEAN                        NOT NULL,
                sheet            JSONB                          NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_kitchen_copy_event ON kitchen_copies (event_id, recorded_at)');
        $this->addSql('CREATE INDEX IDX_KITCHEN_COPIES_RECORDED_BY ON kitchen_copies (recorded_by_id)');
        $this->addSql(<<<'SQL'
            ALTER TABLE kitchen_copies
                ADD CONSTRAINT FK_KITCHEN_COPIES_EVENT FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE kitchen_copies
                ADD CONSTRAINT FK_KITCHEN_COPIES_RECORDED_BY FOREIGN KEY (recorded_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE kitchen_copies');
        $this->addSql('DROP TABLE kitchen_final_numbers');
    }
}
