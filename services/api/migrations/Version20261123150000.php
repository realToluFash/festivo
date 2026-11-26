<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261123150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Passkeys as a second factor (sc-86885), and the single-use challenges a passkey answers.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE passkeys (
                id            UUID NOT NULL,
                user_id       UUID NOT NULL,
                credential_id VARCHAR(1400) NOT NULL,
                public_key    TEXT NOT NULL,
                aaguid        VARCHAR(36) NOT NULL,
                backed_up     BOOLEAN NOT NULL,
                sign_count    BIGINT NOT NULL,
                last_used_at  TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at    TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at    TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_passkey_user ON passkeys (user_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_passkey_credential ON passkeys (credential_id)');
        $this->addSql(<<<'SQL'
            ALTER TABLE passkeys
                ADD CONSTRAINT FK_42BD7728A76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE
            SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE passkey_challenges (
                id             UUID NOT NULL,
                user_id        UUID NOT NULL,
                step           VARCHAR(16) NOT NULL,
                challenge_hash VARCHAR(64) NOT NULL,
                expires_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                created_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_passkey_challenge_user ON passkey_challenges (user_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_passkey_challenge_hash ON passkey_challenges (challenge_hash)');
        $this->addSql(<<<'SQL'
            ALTER TABLE passkey_challenges
                ADD CONSTRAINT FK_DD1CF0EEA76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE passkey_challenges');
        $this->addSql('DROP TABLE passkeys');
    }
}
