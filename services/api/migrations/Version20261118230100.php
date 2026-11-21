<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261118230100 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Every organisation without a subscription is given one on its sc-581 plan, and a billing account its earliest-joined owner is the contact of (sc-3927).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            WITH missing AS MATERIALIZED (
                SELECT o.id                 AS organisation_id,
                       gen_random_uuid()    AS account_id,
                       o.plan,
                       o.currency,
                       o.country_code,
                       o.created_at,
                       COALESCE((
                           SELECT e.address
                           FROM   memberships m
                           JOIN   roles r           ON r.id = m.role_id
                           JOIN   email_addresses e ON e.user_id = m.user_id AND e.is_primary
                           WHERE  m.organisation_id = o.id
                             AND  r.seeded_as = 'owner'
                             AND  m.status = 'active'
                           ORDER  BY m.joined_at ASC NULLS LAST, m.id ASC
                           LIMIT  1
                       ), o.contact_address) AS contact_email
                FROM   organisations o
                WHERE  NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.organisation_id = o.id)
            ),
            accounts AS (
                INSERT INTO billing_accounts (id, contact_email, currency, country_code, credit_balance, created_at, updated_at)
                SELECT account_id, contact_email, currency, country_code, 0, NOW(), NOW()
                FROM   missing
            )
            INSERT INTO subscriptions (id, organisation_id, billing_account_id, plan, period_start, status, source, created_at, updated_at)
            SELECT gen_random_uuid(), organisation_id, account_id, plan, created_at, 'active', 'manual', NOW(), NOW()
            FROM   missing
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DELETE FROM subscriptions');
        $this->addSql('DELETE FROM billing_accounts');
    }
}
