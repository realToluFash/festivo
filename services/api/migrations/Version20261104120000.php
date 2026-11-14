<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261104120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A role on each event (sc-29912): who is on it, and as what.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE event_people (
                id            UUID NOT NULL,
                event_id      UUID NOT NULL,
                membership_id UUID NOT NULL,
                role          VARCHAR(20) NOT NULL,
                job_label     VARCHAR(60) DEFAULT NULL,
                created_at    TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at    TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_event_person ON event_people (event_id, membership_id)');
        $this->addSql('CREATE INDEX idx_event_person_membership ON event_people (membership_id)');
        $this->addSql('CREATE INDEX IDX_1A8F1D7471F7E88B ON event_people (event_id)');
        $this->addSql('ALTER TABLE event_people ADD CONSTRAINT FK_1A8F1D7471F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE event_people ADD CONSTRAINT FK_1A8F1D741FB354CD FOREIGN KEY (membership_id) REFERENCES memberships (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->throwIrreversibleMigrationException('The roles that were removed, and what each held, are not kept.');
    }
}
