<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261128103000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Single sign-on (sc-610): a Test sign-on waiting for the identity provider\'s answer.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE organisation_sso_attempts (
                id             UUID NOT NULL,
                provider_id    UUID NOT NULL,
                started_by_id  UUID NOT NULL,
                state_hash     VARCHAR(64) NOT NULL,
                nonce          VARCHAR(64) NOT NULL,
                code_verifier  VARCHAR(64) NOT NULL,
                expires_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_sso_attempt_state ON organisation_sso_attempts (state_hash)');
        $this->addSql('ALTER TABLE organisation_sso_attempts ADD CONSTRAINT fk_sso_attempt_provider FOREIGN KEY (provider_id) REFERENCES organisation_sso_providers (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE organisation_sso_attempts ADD CONSTRAINT fk_sso_attempt_user FOREIGN KEY (started_by_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE organisation_sso_attempts');
    }
}
