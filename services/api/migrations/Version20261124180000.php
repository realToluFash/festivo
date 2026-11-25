<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261124180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Paddle (sc-3933): each provider event id once, the provider time a subscription was last set from, the payment method as the provider returns it, and one history line per event and kind.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE provider_events (
                event_id VARCHAR(64) NOT NULL,
                event_type VARCHAR(64) NOT NULL,
                occurred_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                received_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (event_id)
            )
            SQL);

        $this->addSql('ALTER TABLE subscriptions ADD provider_updated_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');

        $this->addSql(<<<'SQL'
            ALTER TABLE billing_accounts
                ADD payment_method_type VARCHAR(20) DEFAULT NULL,
                ADD card_brand VARCHAR(20) DEFAULT NULL,
                ADD card_last4 VARCHAR(4) DEFAULT NULL,
                ADD card_expiry_month SMALLINT DEFAULT NULL,
                ADD card_expiry_year SMALLINT DEFAULT NULL
            SQL);

        $this->addSql(<<<'SQL'
            CREATE UNIQUE INDEX uniq_subscription_change_provider_event
                ON subscription_changes (actor_label, kind)
                WHERE actor_type = 'system' AND actor_label IS NOT NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX uniq_subscription_change_provider_event');
        $this->addSql(<<<'SQL'
            ALTER TABLE billing_accounts
                DROP payment_method_type,
                DROP card_brand,
                DROP card_last4,
                DROP card_expiry_month,
                DROP card_expiry_year
            SQL);
        $this->addSql('ALTER TABLE subscriptions DROP provider_updated_at');
        $this->addSql('DROP TABLE provider_events');
    }
}
