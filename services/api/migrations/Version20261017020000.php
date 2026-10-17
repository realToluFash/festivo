<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017020000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Two-factor: an encrypted authenticator secret, recovery codes, and sign-in challenges.';
    }

    public function up(Schema $schema): void
    {
        // New tables: no account had a second factor before them.
        $this->addSql(<<<'SQL'
            CREATE TABLE two_factor_factors (
                id                  UUID NOT NULL,
                encrypted_secret    TEXT NOT NULL,
                activated_at        TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                last_accepted_step  BIGINT DEFAULT NULL,
                created_at          TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at          TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                user_id             UUID NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_two_factor_factor_user ON two_factor_factors (user_id)');
        $this->addSql('ALTER TABLE two_factor_factors ADD CONSTRAINT FK_CE3AD6B9A76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE recovery_codes (
                id          UUID NOT NULL,
                code_hash   VARCHAR(255) NOT NULL,
                used_at     TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                user_id     UUID NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_recovery_code_user ON recovery_codes (user_id)');
        $this->addSql('ALTER TABLE recovery_codes ADD CONSTRAINT FK_F1F70537A76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE two_factor_challenges (
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
        $this->addSql('CREATE UNIQUE INDEX uniq_two_factor_challenge_hash ON two_factor_challenges (token_hash)');
        $this->addSql('CREATE INDEX idx_two_factor_challenge_user ON two_factor_challenges (user_id)');
        $this->addSql('ALTER TABLE two_factor_challenges ADD CONSTRAINT FK_1207DB1CA76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE two_factor_challenges DROP CONSTRAINT FK_1207DB1CA76ED395');
        $this->addSql('ALTER TABLE recovery_codes DROP CONSTRAINT FK_F1F70537A76ED395');
        $this->addSql('ALTER TABLE two_factor_factors DROP CONSTRAINT FK_CE3AD6B9A76ED395');
        $this->addSql('DROP TABLE two_factor_challenges');
        $this->addSql('DROP TABLE recovery_codes');
        $this->addSql('DROP TABLE two_factor_factors');
    }
}
