<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261114130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An event\'s guest groups (sc-3775), one name each within the event, and a host\'s group beside them. No event has a group yet, so every guest starts in none and nothing is backfilled.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE guest_groups (
                id         UUID NOT NULL,
                event_id   UUID NOT NULL,
                name       VARCHAR(60) NOT NULL,
                name_key   VARCHAR(240) NOT NULL,
                created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_guest_group_name ON guest_groups (event_id, name_key)');
        $this->addSql('CREATE INDEX IDX_EAA2139A71F7E88B ON guest_groups (event_id)');
        $this->addSql('ALTER TABLE guest_groups ADD CONSTRAINT FK_EAA2139A71F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE guests ADD group_id UUID DEFAULT NULL');
        $this->addSql('ALTER TABLE guests ADD CONSTRAINT FK_4D11BCB2FE54D947 FOREIGN KEY (group_id) REFERENCES guest_groups (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('CREATE INDEX IDX_4D11BCB2FE54D947 ON guests (group_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests DROP CONSTRAINT FK_4D11BCB2FE54D947');
        $this->addSql('DROP INDEX IDX_4D11BCB2FE54D947');
        $this->addSql('ALTER TABLE guests DROP group_id');
        $this->addSql('DROP TABLE guest_groups');
    }
}
