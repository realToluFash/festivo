<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261119180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'The plan catalogue, versioned: the owner\'s plans and unit costs of 19 Oct as its first versions, every subscription on that plans version, and no version ever updated in place (sc-3928).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE catalogue_versions (
                id              UUID NOT NULL,
                part            VARCHAR(20) NOT NULL,
                name            VARCHAR(40) NOT NULL,
                terms           JSONB NOT NULL,
                note            VARCHAR(2000) NOT NULL,
                published_by    VARCHAR(255) NOT NULL,
                published_at    TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                effective_from  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_catalogue_version_name ON catalogue_versions (part, name)');

        $this->addSql(<<<'SQL'
            CREATE FUNCTION catalogue_version_unchanged() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'A catalogue version is never edited: publish a new one (sc-3928).';
            END $$ LANGUAGE plpgsql
            SQL);
        $this->addSql(<<<'SQL'
            CREATE TRIGGER catalogue_version_unchanged
            BEFORE UPDATE ON catalogue_versions
            FOR EACH ROW EXECUTE FUNCTION catalogue_version_unchanged()
            SQL);

        $this->addSql(<<<'SQL'
            INSERT INTO catalogue_versions (id, part, name, terms, note, published_by, published_at, effective_from)
            VALUES (
                gen_random_uuid(),
                'plans',
                '2026-10-19',
                '{
                    "free": {
                        "sales": "self_serve",
                        "limits": {
                            "live_events":      {"kind": "hard", "amount": 2},
                            "guests_per_event": {"kind": "hard", "amount": 100},
                            "team_seats":       {"kind": "hard", "amount": 3},
                            "email":            {"kind": "included", "amount": 2500},
                            "sms":              {"kind": "metered", "amount": 0},
                            "whatsapp":         {"kind": "metered", "amount": 0},
                            "ai_requests":      {"kind": "metered", "amount": 5},
                            "storage_bytes":    {"kind": "metered", "amount": 2147483648},
                            "credits":          {"kind": "credits", "amount": 50}
                        },
                        "prices": {
                            "USD": {"month": 0, "year": 0},
                            "EUR": {"month": 0, "year": 0},
                            "GBP": {"month": 0, "year": 0}
                        },
                        "features": ["service_floor", "guest_list", "seating", "invitations", "budget", "vendors", "sms_channel", "whatsapp_channel", "assistant"]
                    },
                    "enterprise": {
                        "sales": "contract",
                        "limits": {
                            "live_events":      {"kind": "hard", "amount": "unlimited"},
                            "guests_per_event": {"kind": "hard", "amount": "unlimited"},
                            "team_seats":       {"kind": "hard", "amount": "unlimited"},
                            "email":            {"kind": "included", "amount": 100000},
                            "sms":              {"kind": "metered", "amount": 0},
                            "whatsapp":         {"kind": "metered", "amount": 0},
                            "ai_requests":      {"kind": "metered", "amount": 100},
                            "storage_bytes":    {"kind": "metered", "amount": 107374182400},
                            "credits":          {"kind": "credits", "amount": 3000}
                        },
                        "prices": {
                            "USD": {"month": 24900, "year": 249000},
                            "EUR": {"month": 22900, "year": 229000},
                            "GBP": {"month": 19900, "year": 199000}
                        },
                        "features": ["service_floor", "guest_list", "seating", "invitations", "budget", "vendors", "sms_channel", "whatsapp_channel", "assistant", "email_domains", "audit_log", "guest_data_deletion", "margin", "branding", "api"]
                    }
                }'::jsonb,
                'The owner''s limits, included amounts, prices and feature map of 19 Oct 2026 (sc-3928 #4229, #4613).',
                'The owner, on bm''s memos',
                '2026-10-19 00:00:00',
                '2026-10-19 00:00:00'
            ),
            (
                gen_random_uuid(),
                'unit_costs',
                '2026-10-19',
                '{
                    "credit_price": {"USD": 1},
                    "provider_micro_dollars_per_credit": 6300,
                    "email": 0,
                    "ai": {"model": "claude-opus-5-5", "proposal": 13, "question": 0},
                    "sms_per_segment": {
                        "US": 2, "GB": 9, "DE": 18, "FR": 13, "ES": 14, "PT": 8,
                        "BR": 10, "MX": 29, "CO": 10, "ZA": 22, "NG": 62
                    },
                    "whatsapp": {
                        "utility": {
                            "US": 1, "GB": 5, "DE": 9, "FR": 5, "ES": 4, "PT": 3,
                            "BR": 2, "MX": 2, "CO": 1, "ZA": 2, "NG": 2
                        },
                        "marketing": {"GB": 12, "BR": 12, "NG": 10}
                    }
                }'::jsonb,
                'The owner''s credits per unit of 19 Oct 2026: SMS per segment and WhatsApp per message by destination, AI per delivered proposal on claude-opus-5-5 (sc-3928 #4131, #4215).',
                'The owner, on bm''s memos',
                '2026-10-19 00:00:00',
                '2026-10-19 00:00:00'
            )
            SQL);

        $this->addSql('ALTER TABLE subscriptions ADD catalogue_version_id UUID DEFAULT NULL');
        $this->addSql(<<<'SQL'
            UPDATE subscriptions
            SET    catalogue_version_id = (SELECT id FROM catalogue_versions WHERE part = 'plans' AND name = '2026-10-19')
            SQL);
        $this->addSql('ALTER TABLE subscriptions ALTER catalogue_version_id SET NOT NULL');
        $this->addSql('ALTER TABLE subscriptions DROP catalogue_version');
        $this->addSql('ALTER TABLE subscriptions ADD CONSTRAINT FK_4778A01300AACFB FOREIGN KEY (catalogue_version_id) REFERENCES catalogue_versions (id) ON DELETE RESTRICT NOT DEFERRABLE');
        $this->addSql('CREATE INDEX IDX_4778A01300AACFB ON subscriptions (catalogue_version_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE subscriptions DROP CONSTRAINT FK_4778A01300AACFB');
        $this->addSql('DROP INDEX IDX_4778A01300AACFB');
        $this->addSql('ALTER TABLE subscriptions ADD catalogue_version VARCHAR(40) DEFAULT NULL');
        $this->addSql('ALTER TABLE subscriptions DROP catalogue_version_id');
        $this->addSql('DROP TABLE catalogue_versions');
        $this->addSql('DROP FUNCTION catalogue_version_unchanged()');
    }
}
