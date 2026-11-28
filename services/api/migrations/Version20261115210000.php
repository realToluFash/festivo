<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261115210000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'The tables in a seating plan: shape, size in centimetres, seats, seats on the ends, rotation, place and unusable chairs (sc-4000). No plan has one yet.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE seating_tables (
                id              UUID NOT NULL,
                plan_id         UUID NOT NULL,
                section_id      UUID DEFAULT NULL,
                name            VARCHAR(30) NOT NULL,
                name_key        VARCHAR(120) NOT NULL,
                shape           VARCHAR(16) NOT NULL,
                seats           SMALLINT NOT NULL,
                width_cm        INT NOT NULL,
                length_cm       INT NOT NULL,
                end_seats       SMALLINT NOT NULL,
                rotation        SMALLINT NOT NULL,
                x_cm            INT NOT NULL,
                y_cm            INT NOT NULL,
                unusable_seats  JSON DEFAULT '[]' NOT NULL,
                changed_by_id   UUID DEFAULT NULL,
                version         INT DEFAULT 1 NOT NULL,
                created_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_seating_table_name ON seating_tables (plan_id, name_key)');
        $this->addSql('CREATE INDEX IDX_2A0061F0E899029B ON seating_tables (plan_id)');
        $this->addSql('CREATE INDEX IDX_2A0061F0D823E37A ON seating_tables (section_id)');
        $this->addSql('CREATE INDEX IDX_2A0061F0828AD0A0 ON seating_tables (changed_by_id)');
        $this->addSql('ALTER TABLE seating_tables ADD CONSTRAINT FK_2A0061F0E899029B FOREIGN KEY (plan_id) REFERENCES seating_plans (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE seating_tables ADD CONSTRAINT FK_2A0061F0D823E37A FOREIGN KEY (section_id) REFERENCES seating_sections (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE seating_tables ADD CONSTRAINT FK_2A0061F0828AD0A0 FOREIGN KEY (changed_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE seating_tables');
    }
}
