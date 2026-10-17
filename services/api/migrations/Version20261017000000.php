<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A provider identity: who Google says a person is, linked to their account.';
    }

    public function up(Schema $schema): void
    {
        // A new table: nothing before it signed in with a provider.
        $this->addSql(<<<'SQL'
            CREATE TABLE provider_identities (
                id          UUID NOT NULL,
                provider    VARCHAR(32) NOT NULL,
                subject     VARCHAR(255) NOT NULL,
                created_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                user_id     UUID NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_provider_identity_user ON provider_identities (user_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_provider_subject ON provider_identities (provider, subject)');
        $this->addSql('ALTER TABLE provider_identities ADD CONSTRAINT FK_DF8F6050A76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE provider_identities DROP CONSTRAINT FK_DF8F6050A76ED395');
        $this->addSql('DROP TABLE provider_identities');
    }
}
