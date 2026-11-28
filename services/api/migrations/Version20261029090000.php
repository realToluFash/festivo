<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261029090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'The devices each member takes push on, Web Push and Expo in one table (sc-3980).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE push_targets (
                id           UUID NOT NULL,
                user_id      UUID NOT NULL,
                session_id   UUID NOT NULL,
                kind         VARCHAR(8) NOT NULL,
                address      TEXT NOT NULL,
                public_key   VARCHAR(255) DEFAULT NULL,
                auth_secret  VARCHAR(255) DEFAULT NULL,
                created_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_push_target_address ON push_targets (address)');
        $this->addSql('CREATE INDEX idx_push_target_session ON push_targets (session_id)');
        $this->addSql('CREATE INDEX IDX_9406840AA76ED395 ON push_targets (user_id)');
        $this->addSql('ALTER TABLE push_targets ADD CONSTRAINT FK_9406840AA76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE push_targets');
    }
}
