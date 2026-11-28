<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261119013900 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Arrivals at the door, and walk-ins (sc-1454): a walk-in is a guest with no invitation link.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE guests
                ADD arrived_at    TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                ADD arrived_by_id UUID DEFAULT NULL,
                ADD walk_in       BOOLEAN DEFAULT false NOT NULL
            SQL);
        $this->addSql('ALTER TABLE guests ADD CONSTRAINT FK_4D11BCB26A8A8FF7 FOREIGN KEY (arrived_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('CREATE INDEX IDX_4D11BCB26A8A8FF7 ON guests (arrived_by_id)');
        $this->addSql('ALTER TABLE guests DROP CONSTRAINT guests_link_only_for_a_guest');
        $this->addSql('ALTER TABLE guests ADD CONSTRAINT guests_link_only_for_a_guest CHECK ((host_id IS NULL AND NOT walk_in) = (link_token IS NOT NULL))');
        $this->addSql('ALTER TABLE guests ADD CONSTRAINT guests_walk_in_is_a_guest CHECK (NOT walk_in OR host_id IS NULL)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DELETE FROM guests WHERE walk_in');
        $this->addSql('ALTER TABLE guests DROP CONSTRAINT guests_walk_in_is_a_guest');
        $this->addSql('ALTER TABLE guests DROP CONSTRAINT guests_link_only_for_a_guest');
        $this->addSql('ALTER TABLE guests ADD CONSTRAINT guests_link_only_for_a_guest CHECK ((host_id IS NULL) = (link_token IS NOT NULL))');
        $this->addSql('ALTER TABLE guests DROP CONSTRAINT FK_4D11BCB26A8A8FF7');
        $this->addSql('DROP INDEX IDX_4D11BCB26A8A8FF7');
        $this->addSql(<<<'SQL'
            ALTER TABLE guests
                DROP arrived_at,
                DROP arrived_by_id,
                DROP walk_in
            SQL);
    }
}
