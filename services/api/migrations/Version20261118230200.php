<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261118230200 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An organisation\'s plan is its subscription\'s alone (sc-3927).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM organisations o WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.organisation_id = o.id)) THEN
                    RAISE EXCEPTION 'organisations still has rows with no subscription; the backfill did not cover them';
                END IF;
            END $$;
            SQL);
        $this->addSql('ALTER TABLE organisations DROP plan');
    }

    public function down(Schema $schema): void
    {
        $this->addSql("ALTER TABLE organisations ADD plan VARCHAR(20) DEFAULT 'free' NOT NULL");
        $this->addSql(<<<'SQL'
            UPDATE organisations o
            SET    plan = s.plan
            FROM   subscriptions s
            WHERE  s.organisation_id = o.id
            SQL);
    }
}
