<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261117150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A room screen link for each place of an event\'s schedule, kept once replaced so its screen can say so (sc-3897).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE screen_links (
                id           UUID NOT NULL,
                event_id     UUID NOT NULL,
                place        VARCHAR(240) NOT NULL,
                seed         VARCHAR(64) NOT NULL,
                token_hash   VARCHAR(64) NOT NULL,
                replaced_at  TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_screen_link_token_hash ON screen_links (token_hash)');
        $this->addSql('CREATE UNIQUE INDEX uniq_screen_link_place ON screen_links (event_id, place) WHERE (replaced_at IS NULL)');
        $this->addSql('CREATE INDEX IDX_AC85815C71F7E88B ON screen_links (event_id)');
        $this->addSql('ALTER TABLE screen_links ADD CONSTRAINT FK_AC85815C71F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE screen_links');
    }
}
