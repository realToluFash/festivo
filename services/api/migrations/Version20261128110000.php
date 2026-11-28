<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261128110000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Single sign-on (sc-610): signing in through the provider, and which sessions came that way.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE organisation_sso_attempts ALTER started_by_id DROP NOT NULL');
        $this->addSql('ALTER TABLE organisation_sso_attempts ADD client_challenge VARCHAR(128) DEFAULT NULL');
        $this->addSql(<<<'SQL'
            CREATE TABLE organisation_sso_handoffs (
                id               UUID NOT NULL,
                provider_id      UUID NOT NULL,
                user_id          UUID NOT NULL,
                handle_hash      VARCHAR(64) NOT NULL,
                client_challenge VARCHAR(128) NOT NULL,
                expires_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_sso_handoff_handle ON organisation_sso_handoffs (handle_hash)');
        $this->addSql('ALTER TABLE organisation_sso_handoffs ADD CONSTRAINT fk_sso_handoff_provider FOREIGN KEY (provider_id) REFERENCES organisation_sso_providers (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE organisation_sso_handoffs ADD CONSTRAINT fk_sso_handoff_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE refresh_tokens ADD by_single_sign_on BOOLEAN DEFAULT FALSE NOT NULL');
        $this->addSql('ALTER TABLE two_factor_challenges ADD by_single_sign_on BOOLEAN DEFAULT FALSE NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE two_factor_challenges DROP by_single_sign_on');
        $this->addSql('ALTER TABLE refresh_tokens DROP by_single_sign_on');
        $this->addSql('DROP TABLE organisation_sso_handoffs');
        $this->addSql('DELETE FROM organisation_sso_attempts WHERE started_by_id IS NULL');
        $this->addSql('ALTER TABLE organisation_sso_attempts DROP client_challenge');
        $this->addSql('ALTER TABLE organisation_sso_attempts ALTER started_by_id SET NOT NULL');
    }
}
