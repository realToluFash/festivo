<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261128100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Seating notes (sc-1364): two guests the host wants together or apart, one row a pair, deleted with either guest.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE seating_notes (
                id             UUID NOT NULL,
                event_id       UUID NOT NULL,
                guest_id       UUID NOT NULL,
                other_guest_id UUID NOT NULL,
                kind           VARCHAR(16) NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_seating_note_event ON seating_notes (event_id)');
        $this->addSql('CREATE INDEX IDX_6E4B7A1A5F2D2B0C ON seating_notes (guest_id)');
        $this->addSql('CREATE INDEX IDX_6E4B7A1A9C0F3E21 ON seating_notes (other_guest_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_seating_note_pair ON seating_notes (guest_id, other_guest_id)');
        $this->addSql('ALTER TABLE seating_notes ADD CONSTRAINT FK_6E4B7A1A71F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE seating_notes ADD CONSTRAINT FK_6E4B7A1A5F2D2B0C FOREIGN KEY (guest_id) REFERENCES guests (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE seating_notes ADD CONSTRAINT FK_6E4B7A1A9C0F3E21 FOREIGN KEY (other_guest_id) REFERENCES guests (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE seating_notes');
    }
}
