<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261021180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An organisation has events: a Draft with a name, a wall-clock start and end in its own zone, the UTC instants derived from them, and a currency.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE events (
                id               UUID NOT NULL,
                organisation_id  UUID NOT NULL,
                name             VARCHAR(120) NOT NULL,
                status           VARCHAR(20) NOT NULL,
                starts_at        TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                ends_at          TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                time_zone        VARCHAR(64) NOT NULL,
                starts_at_utc    TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                ends_at_utc      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                ended_at         TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                closes_at        TIMESTAMP(0) WITHOUT TIME ZONE GENERATED ALWAYS AS (COALESCE(ended_at, ends_at_utc)) STORED,
                currency         VARCHAR(3) NOT NULL,
                created_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_event_organisation_starts ON events (organisation_id, starts_at_utc)');
        $this->addSql('CREATE INDEX idx_event_organisation_closes ON events (organisation_id, closes_at)');
        $this->addSql('ALTER TABLE events ADD CONSTRAINT FK_events_organisation FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE events');
    }
}
