<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261124120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'One meter (sc-3929): usage records written once per key, reservations and what a lost settle gave back, running totals per organisation, period and kind, and the credits a billing account has set aside. It starts empty: nothing used before it is backfilled.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE billing_accounts ADD credits_held INT DEFAULT 0 NOT NULL');

        $this->addSql(<<<'SQL'
            CREATE TABLE usage_reservations (
                id                    UUID NOT NULL,
                organisation_id       UUID NOT NULL,
                billing_account_id    UUID NOT NULL,
                kind                  VARCHAR(20) NOT NULL,
                quantity              INT NOT NULL,
                country               VARCHAR(2) DEFAULT NULL,
                whats_app_category    VARCHAR(20) DEFAULT NULL,
                unit_cost_version_id  UUID NOT NULL,
                credits_per_unit      INT NOT NULL,
                period_start          TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                included_units        INT NOT NULL,
                credit_units          INT NOT NULL,
                included_held         INT NOT NULL,
                credit_units_held     INT NOT NULL,
                reserved_at           TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                released_at           TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                PRIMARY KEY (id),
                CONSTRAINT chk_usage_reservation_kind CHECK (kind IN ('email', 'sms', 'whatsapp', 'ai_request')),
                CONSTRAINT chk_usage_reservation_held CHECK (included_held BETWEEN 0 AND included_units AND credit_units_held BETWEEN 0 AND credit_units)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_usage_reservation_unreleased ON usage_reservations (reserved_at) WHERE released_at IS NULL');
        $this->addSql('CREATE INDEX IDX_6EAD9EAC9E6B1585 ON usage_reservations (organisation_id)');
        $this->addSql('CREATE INDEX IDX_6EAD9EAC170C302B ON usage_reservations (billing_account_id)');
        $this->addSql('CREATE INDEX IDX_6EAD9EACB0A3D24A ON usage_reservations (unit_cost_version_id)');
        $this->addSql('ALTER TABLE usage_reservations ADD CONSTRAINT FK_6EAD9EAC9E6B1585 FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE usage_reservations ADD CONSTRAINT FK_6EAD9EAC170C302B FOREIGN KEY (billing_account_id) REFERENCES billing_accounts (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE usage_reservations ADD CONSTRAINT FK_6EAD9EACB0A3D24A FOREIGN KEY (unit_cost_version_id) REFERENCES catalogue_versions (id) ON DELETE RESTRICT NOT DEFERRABLE');

        // The key scope is the kind's, except that the three message kinds share one, so the unique key below holds a message to one record whichever channel reports it.
        $this->addSql(<<<'SQL'
            CREATE TABLE usage_records (
                id                    UUID NOT NULL,
                organisation_id       UUID NOT NULL,
                billing_account_id    UUID NOT NULL,
                kind                  VARCHAR(20) NOT NULL,
                key_scope             VARCHAR(20) NOT NULL,
                idempotency_key       VARCHAR(255) NOT NULL,
                quantity              BIGINT NOT NULL,
                country               VARCHAR(2) DEFAULT NULL,
                whats_app_category    VARCHAR(20) DEFAULT NULL,
                occurred_at           TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                period_start          TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                paid_by               VARCHAR(20) NOT NULL,
                included_quantity     BIGINT NOT NULL,
                credits_taken         INT NOT NULL,
                unit_cost_version_id  UUID DEFAULT NULL,
                credits_per_unit      INT NOT NULL,
                reservation_id        UUID DEFAULT NULL,
                late                  BOOLEAN DEFAULT false NOT NULL,
                corrects_id           UUID DEFAULT NULL,
                PRIMARY KEY (id),
                CONSTRAINT chk_usage_record_key_scope CHECK (
                    (kind IN ('email', 'sms', 'whatsapp') AND key_scope = 'message')
                    OR (kind IN ('ai_request', 'storage_bytes') AND key_scope = kind)
                )
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_usage_record_key ON usage_records (key_scope, idempotency_key)');
        $this->addSql('CREATE INDEX idx_usage_record_period ON usage_records (organisation_id, period_start, kind)');
        $this->addSql('CREATE INDEX IDX_C2192E599E6B1585 ON usage_records (organisation_id)');
        $this->addSql('CREATE INDEX IDX_C2192E59170C302B ON usage_records (billing_account_id)');
        $this->addSql('CREATE INDEX IDX_C2192E59B0A3D24A ON usage_records (unit_cost_version_id)');
        $this->addSql('CREATE INDEX IDX_C2192E59B83297E7 ON usage_records (reservation_id)');
        $this->addSql('CREATE INDEX IDX_C2192E5994B287F ON usage_records (corrects_id)');
        $this->addSql('ALTER TABLE usage_records ADD CONSTRAINT FK_C2192E599E6B1585 FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE usage_records ADD CONSTRAINT FK_C2192E59170C302B FOREIGN KEY (billing_account_id) REFERENCES billing_accounts (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE usage_records ADD CONSTRAINT FK_C2192E59B0A3D24A FOREIGN KEY (unit_cost_version_id) REFERENCES catalogue_versions (id) ON DELETE RESTRICT NOT DEFERRABLE');
        $this->addSql('ALTER TABLE usage_records ADD CONSTRAINT FK_C2192E59B83297E7 FOREIGN KEY (reservation_id) REFERENCES usage_reservations (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE usage_records ADD CONSTRAINT FK_C2192E5994B287F FOREIGN KEY (corrects_id) REFERENCES usage_records (id) ON DELETE CASCADE NOT DEFERRABLE');

        // Never edited: a correction is a record of its own. A row goes only with its organisation's purge.
        $this->addSql(<<<'SQL'
            CREATE FUNCTION usage_records_never_change() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                RAISE EXCEPTION 'usage_records are never edited: record a correction instead (sc-3929)';
            END $$
            SQL);
        $this->addSql('CREATE TRIGGER usage_records_never_change BEFORE UPDATE ON usage_records FOR EACH ROW EXECUTE FUNCTION usage_records_never_change()');

        $this->addSql(<<<'SQL'
            CREATE TABLE usage_hold_releases (
                id               UUID NOT NULL,
                reservation_id   UUID NOT NULL,
                key_scope        VARCHAR(20) NOT NULL,
                idempotency_key  VARCHAR(255) NOT NULL,
                units            INT NOT NULL,
                released_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_usage_hold_release_key ON usage_hold_releases (reservation_id, key_scope, idempotency_key)');
        $this->addSql('CREATE INDEX IDX_B3D42ED5B83297E7 ON usage_hold_releases (reservation_id)');
        $this->addSql('ALTER TABLE usage_hold_releases ADD CONSTRAINT FK_B3D42ED5B83297E7 FOREIGN KEY (reservation_id) REFERENCES usage_reservations (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE usage_totals (
                organisation_id  UUID NOT NULL,
                period_start     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                kind             VARCHAR(20) NOT NULL,
                used             BIGINT DEFAULT 0 NOT NULL,
                included_used    BIGINT DEFAULT 0 NOT NULL,
                included_held    BIGINT DEFAULT 0 NOT NULL,
                credits_taken    BIGINT DEFAULT 0 NOT NULL,
                PRIMARY KEY (organisation_id, period_start, kind)
            )
            SQL);
        $this->addSql('CREATE INDEX IDX_CD908D619E6B1585 ON usage_totals (organisation_id)');
        $this->addSql('ALTER TABLE usage_totals ADD CONSTRAINT FK_CD908D619E6B1585 FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE usage_totals');
        $this->addSql('DROP TABLE usage_hold_releases');
        $this->addSql('DROP TABLE usage_records');
        $this->addSql('DROP FUNCTION usage_records_never_change()');
        $this->addSql('DROP TABLE usage_reservations');
        $this->addSql('ALTER TABLE billing_accounts DROP credits_held');
    }
}
