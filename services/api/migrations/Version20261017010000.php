<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017010000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A password reset link, kept as the hash of what was emailed.';
    }

    public function up(Schema $schema): void
    {
        // A new table: no reset link was ever sent before it.
        $this->addSql(<<<'SQL'
            CREATE TABLE password_reset_tokens (
                id          UUID NOT NULL,
                token_hash  VARCHAR(64) NOT NULL,
                expires_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                used_at     TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                user_id     UUID NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_password_reset_token_user ON password_reset_tokens (user_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_password_reset_token_hash ON password_reset_tokens (token_hash)');
        $this->addSql('ALTER TABLE password_reset_tokens ADD CONSTRAINT FK_3967A216A76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE password_reset_tokens DROP CONSTRAINT FK_3967A216A76ED395');
        $this->addSql('DROP TABLE password_reset_tokens');
    }
}
