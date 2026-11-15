<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261101120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return "A person's private link to subscribe to an organisation's events in a calendar app, kept as the seed it is signed from and its token's hash (sc-3626).";
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE calendar_feeds (
                id              UUID NOT NULL,
                user_id         UUID NOT NULL,
                organisation_id UUID NOT NULL,
                seed            VARCHAR(64) NOT NULL,
                token_hash      VARCHAR(64) NOT NULL,
                created_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_calendar_feed_token_hash ON calendar_feeds (token_hash)');
        $this->addSql('CREATE UNIQUE INDEX uniq_calendar_feed_member ON calendar_feeds (user_id, organisation_id)');
        $this->addSql('CREATE INDEX IDX_367DF641A76ED395 ON calendar_feeds (user_id)');
        $this->addSql('CREATE INDEX IDX_367DF6419E6B1585 ON calendar_feeds (organisation_id)');
        $this->addSql('ALTER TABLE calendar_feeds ADD CONSTRAINT FK_367DF641A76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE calendar_feeds ADD CONSTRAINT FK_367DF6419E6B1585 FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE calendar_feeds');
    }
}
