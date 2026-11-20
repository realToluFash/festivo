<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261120090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Single sign-on (sc-610): an organisation\'s identity provider, the one still signing people in while a new one waits for its test, and required sign-on.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE organisation_sso_providers (
                id                           UUID NOT NULL,
                organisation_id              UUID NOT NULL,
                standing                     VARCHAR(10) NOT NULL,
                protocol                     VARCHAR(10) NOT NULL,
                name                         VARCHAR(40) NOT NULL,
                saved_at                     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                metadata_url                 VARCHAR(2048) DEFAULT NULL,
                metadata_file_name           VARCHAR(255) DEFAULT NULL,
                saml_entity_id               VARCHAR(1024) DEFAULT NULL,
                saml_sign_on_url             VARCHAR(2048) DEFAULT NULL,
                saml_certificates            JSONB NOT NULL,
                oidc_issuer                  VARCHAR(2048) DEFAULT NULL,
                oidc_client_id               VARCHAR(255) DEFAULT NULL,
                oidc_client_secret           TEXT DEFAULT NULL,
                oidc_authorization_endpoint  VARCHAR(2048) DEFAULT NULL,
                oidc_token_endpoint          VARCHAR(2048) DEFAULT NULL,
                oidc_jwks_uri                VARCHAR(2048) DEFAULT NULL,
                tested_at                    TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                tested_email                 VARCHAR(254) DEFAULT NULL,
                tested_name                  VARCHAR(255) DEFAULT NULL,
                test_failure                 VARCHAR(500) DEFAULT NULL,
                switched_on_at               TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_sso_provider_standing ON organisation_sso_providers (organisation_id, standing)');
        $this->addSql('CREATE INDEX IDX_314D602A9E6B1585 ON organisation_sso_providers (organisation_id)');
        $this->addSql('ALTER TABLE organisation_sso_providers ADD CONSTRAINT FK_314D602A9E6B1585 FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE organisations ADD sso_required_since TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE organisations DROP sso_required_since');
        $this->addSql('DROP TABLE organisation_sso_providers');
    }
}
