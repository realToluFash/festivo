<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261014231320 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Holds one row per session, so a session can be ended rather than only expiring.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE refresh_tokens (
                id          UUID NOT NULL,
                user_id     UUID NOT NULL,
                token_hash  VARCHAR(64) NOT NULL,
                expires_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                revoked_at  TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                user_agent  VARCHAR(255) DEFAULT NULL,
                ip_address  VARCHAR(45) DEFAULT NULL,
                created_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);

        $this->addSql('CREATE UNIQUE INDEX uniq_refresh_token_hash ON refresh_tokens (token_hash)');
        $this->addSql('CREATE INDEX idx_refresh_token_user ON refresh_tokens (user_id)');

        $this->addSql(<<<'SQL'
            ALTER TABLE refresh_tokens
                ADD CONSTRAINT fk_refresh_token_user
                FOREIGN KEY (user_id) REFERENCES users (id)
                ON DELETE CASCADE NOT DEFERRABLE
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE refresh_tokens');
    }
}
