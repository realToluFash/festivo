<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261108140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An event\'s seating plan, its room in centimetres, and the sections a host names and colours (sc-3998). No event has one yet.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE seating_plans (
                id             UUID NOT NULL,
                event_id       UUID NOT NULL,
                room_name      VARCHAR(60) DEFAULT NULL,
                width_cm       INT NOT NULL,
                length_cm      INT NOT NULL,
                changed_by_id  UUID DEFAULT NULL,
                version        INT DEFAULT 1 NOT NULL,
                created_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX UNIQ_A36E033971F7E88B ON seating_plans (event_id)');
        $this->addSql('CREATE INDEX IDX_A36E0339828AD0A0 ON seating_plans (changed_by_id)');
        $this->addSql('ALTER TABLE seating_plans ADD CONSTRAINT FK_A36E033971F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE seating_plans ADD CONSTRAINT FK_A36E0339828AD0A0 FOREIGN KEY (changed_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE seating_sections (
                id          UUID NOT NULL,
                plan_id     UUID NOT NULL,
                name        VARCHAR(40) NOT NULL,
                name_key    VARCHAR(160) NOT NULL,
                colour         VARCHAR(16) NOT NULL,
                changed_by_id  UUID DEFAULT NULL,
                version        INT DEFAULT 1 NOT NULL,
                created_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_seating_section_name ON seating_sections (plan_id, name_key)');
        $this->addSql('CREATE INDEX IDX_670E2963E899029B ON seating_sections (plan_id)');
        $this->addSql('CREATE INDEX IDX_670E2963828AD0A0 ON seating_sections (changed_by_id)');
        $this->addSql('ALTER TABLE seating_sections ADD CONSTRAINT FK_670E2963E899029B FOREIGN KEY (plan_id) REFERENCES seating_plans (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE seating_sections ADD CONSTRAINT FK_670E2963828AD0A0 FOREIGN KEY (changed_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE seating_sections');
        $this->addSql('DROP TABLE seating_plans');
    }
}
