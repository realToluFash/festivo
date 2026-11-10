<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Phone codes by WhatsApp first: how each code went, the sealed code for the SMS fallback, the choice to be texted, and the delivery log.';
    }

    public function up(Schema $schema): void
    {
        // Codes from before this have no route: they went by SMS, and the screen says so.
        $this->addSql('ALTER TABLE verification_challenges ADD route VARCHAR(16) DEFAULT NULL');
        $this->addSql('ALTER TABLE verification_challenges ADD whats_app_message_id VARCHAR(128) DEFAULT NULL');
        $this->addSql('ALTER TABLE verification_challenges ADD sealed_code TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE verification_challenges ADD whats_app_delivered BOOLEAN DEFAULT false NOT NULL');
        $this->addSql('ALTER TABLE phone_numbers ADD codes_by_text BOOLEAN DEFAULT false NOT NULL');
        $this->addSql(<<<'SQL'
            CREATE TABLE phone_code_deliveries (
                id            UUID NOT NULL,
                country_code  VARCHAR(2) DEFAULT NULL,
                route         VARCHAR(16) NOT NULL,
                delivered_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_phone_code_delivery_country ON phone_code_deliveries (country_code, delivered_at)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE phone_code_deliveries');
        $this->addSql('ALTER TABLE phone_numbers DROP codes_by_text');
        $this->addSql('ALTER TABLE verification_challenges DROP whats_app_delivered');
        $this->addSql('ALTER TABLE verification_challenges DROP sealed_code');
        $this->addSql('ALTER TABLE verification_challenges DROP whats_app_message_id');
        $this->addSql('ALTER TABLE verification_challenges DROP route');
    }
}
