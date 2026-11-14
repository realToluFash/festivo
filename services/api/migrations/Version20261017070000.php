<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017070000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Linking and unlinking Google and Apple: the address each vouched for, the provider a session started with, and recent proofs.';
    }

    public function up(Schema $schema): void
    {
        // Rows from before this have no address on record, and their Security row shows none until the next sign-in with it.
        $this->addSql('ALTER TABLE provider_identities ADD email VARCHAR(180) DEFAULT NULL');
        // Sessions from before this are treated as password sessions: unlinking a provider leaves them signed in.
        $this->addSql('ALTER TABLE refresh_tokens ADD signed_in_with VARCHAR(32) DEFAULT NULL');
        $this->addSql(<<<'SQL'
            CREATE TABLE sign_in_proofs (
                id          UUID NOT NULL,
                user_id     UUID NOT NULL,
                token_hash  VARCHAR(64) NOT NULL,
                expires_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                created_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_sign_in_proof_hash ON sign_in_proofs (token_hash)');
        $this->addSql('CREATE INDEX idx_sign_in_proof_user ON sign_in_proofs (user_id)');
        $this->addSql('ALTER TABLE sign_in_proofs ADD CONSTRAINT FK_sign_in_proofs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE sign_in_proofs');
        $this->addSql('ALTER TABLE refresh_tokens DROP signed_in_with');
        $this->addSql('ALTER TABLE provider_identities DROP email');
    }
}
