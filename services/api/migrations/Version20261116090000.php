<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261116090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Rows of numbered seats and single seats in a seating plan: label or name, seats, spacing, rotation, place and unusable seats (sc-4003). No plan has either yet.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE seating_rows (
                id              UUID NOT NULL,
                plan_id         UUID NOT NULL,
                section_id      UUID DEFAULT NULL,
                label           VARCHAR(10) NOT NULL,
                label_key       VARCHAR(40) NOT NULL,
                seats           SMALLINT NOT NULL,
                spacing_cm      SMALLINT NOT NULL,
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
        $this->addSql('CREATE UNIQUE INDEX uniq_seating_row_label ON seating_rows (plan_id, label_key)');
        $this->addSql('CREATE INDEX IDX_AB892EBE899029B ON seating_rows (plan_id)');
        $this->addSql('CREATE INDEX IDX_AB892EBD823E37A ON seating_rows (section_id)');
        $this->addSql('CREATE INDEX IDX_AB892EB828AD0A0 ON seating_rows (changed_by_id)');
        $this->addSql('ALTER TABLE seating_rows ADD CONSTRAINT FK_AB892EBE899029B FOREIGN KEY (plan_id) REFERENCES seating_plans (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE seating_rows ADD CONSTRAINT FK_AB892EBD823E37A FOREIGN KEY (section_id) REFERENCES seating_sections (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE seating_rows ADD CONSTRAINT FK_AB892EB828AD0A0 FOREIGN KEY (changed_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE seating_seats (
                id              UUID NOT NULL,
                plan_id         UUID NOT NULL,
                section_id      UUID DEFAULT NULL,
                name            VARCHAR(30) NOT NULL,
                name_key        VARCHAR(120) NOT NULL,
                x_cm            INT NOT NULL,
                y_cm            INT NOT NULL,
                unusable        BOOLEAN DEFAULT false NOT NULL,
                changed_by_id   UUID DEFAULT NULL,
                version         INT DEFAULT 1 NOT NULL,
                created_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_seating_seat_name ON seating_seats (plan_id, name_key)');
        $this->addSql('CREATE INDEX IDX_29EBCCB8E899029B ON seating_seats (plan_id)');
        $this->addSql('CREATE INDEX IDX_29EBCCB8D823E37A ON seating_seats (section_id)');
        $this->addSql('CREATE INDEX IDX_29EBCCB8828AD0A0 ON seating_seats (changed_by_id)');
        $this->addSql('ALTER TABLE seating_seats ADD CONSTRAINT FK_29EBCCB8E899029B FOREIGN KEY (plan_id) REFERENCES seating_plans (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE seating_seats ADD CONSTRAINT FK_29EBCCB8D823E37A FOREIGN KEY (section_id) REFERENCES seating_sections (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE seating_seats ADD CONSTRAINT FK_29EBCCB8828AD0A0 FOREIGN KEY (changed_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE seating_seats');
        $this->addSql('DROP TABLE seating_rows');
    }
}
