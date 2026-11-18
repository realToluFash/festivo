<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261118230000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An organisation has one current subscription, with its history, paid for by a billing account (sc-3927).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE billing_accounts (
                id                    UUID NOT NULL,
                contact_email         VARCHAR(180) NOT NULL,
                currency              VARCHAR(3) NOT NULL,
                country_code          VARCHAR(2) NOT NULL,
                tax_id                VARCHAR(64) DEFAULT NULL,
                credit_balance        INT DEFAULT 0 NOT NULL,
                provider_customer_ref VARCHAR(255) DEFAULT NULL,
                created_at            TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at            TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE subscriptions (
                id                 UUID NOT NULL,
                organisation_id    UUID NOT NULL,
                billing_account_id UUID NOT NULL,
                plan               VARCHAR(20) NOT NULL,
                catalogue_version  VARCHAR(40) DEFAULT NULL,
                period_start       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                period_end         TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                status             VARCHAR(20) NOT NULL,
                source             VARCHAR(20) NOT NULL,
                external_ref       VARCHAR(255) DEFAULT NULL,
                created_at         TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at         TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_subscription_organisation ON subscriptions (organisation_id)');
        $this->addSql('CREATE INDEX idx_subscription_billing_account ON subscriptions (billing_account_id)');
        $this->addSql('ALTER TABLE subscriptions ADD CONSTRAINT FK_4778A019E6B1585 FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE subscriptions ADD CONSTRAINT FK_4778A01170C302B FOREIGN KEY (billing_account_id) REFERENCES billing_accounts (id) NOT DEFERRABLE');
        $this->addSql(<<<'SQL'
            CREATE TABLE subscription_changes (
                id              UUID NOT NULL,
                subscription_id UUID NOT NULL,
                kind            VARCHAR(20) NOT NULL,
                from_value      VARCHAR(64) DEFAULT NULL,
                to_value        VARCHAR(64) DEFAULT NULL,
                actor_type      VARCHAR(20) NOT NULL,
                actor_id        UUID DEFAULT NULL,
                actor_label     VARCHAR(255) DEFAULT NULL,
                reason          VARCHAR(2000) DEFAULT NULL,
                occurred_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_subscription_change_subscription ON subscription_changes (subscription_id)');
        $this->addSql('ALTER TABLE subscription_changes ADD CONSTRAINT FK_533558A69A1887DC FOREIGN KEY (subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE subscription_changes');
        $this->addSql('DROP TABLE subscriptions');
        $this->addSql('DROP TABLE billing_accounts');
    }
}
