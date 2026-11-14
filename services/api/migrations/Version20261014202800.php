<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261014202800 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Creates a user and the addresses they can be reached and identified by.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE users (
                id             UUID NOT NULL,
                password_hash  VARCHAR(255) DEFAULT NULL,
                name           VARCHAR(180) NOT NULL,
                business_name  VARCHAR(180) DEFAULT NULL,
                country_code   VARCHAR(2) DEFAULT NULL,
                locale         VARCHAR(8) DEFAULT NULL,
                created_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                deleted_at     TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                deleted_by     UUID DEFAULT NULL,
                PRIMARY KEY (id)
            )
            SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE email_addresses (
                id           UUID NOT NULL,
                user_id      UUID NOT NULL,
                address      VARCHAR(180) NOT NULL,
                verified_at  TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                is_primary   BOOLEAN NOT NULL,
                created_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE phone_numbers (
                id           UUID NOT NULL,
                user_id      UUID NOT NULL,
                number       VARCHAR(32) NOT NULL,
                verified_at  TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                is_primary   BOOLEAN NOT NULL,
                created_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);

        // Globally unique, not unique per user: two accounts claiming the same
        // address is how a password reset reaches the wrong person.
        $this->addSql('CREATE UNIQUE INDEX uniq_email_address ON email_addresses (address)');
        $this->addSql('CREATE UNIQUE INDEX uniq_phone_number ON phone_numbers (number)');

        $this->addSql('CREATE INDEX idx_email_address_user ON email_addresses (user_id)');
        $this->addSql('CREATE INDEX idx_phone_number_user ON phone_numbers (user_id)');

        // Exactly one primary each, enforced rather than trusted. A partial
        // index rather than a constraint, because the rule is about the rows
        // where is_primary is true and says nothing about the others.
        $this->addSql(<<<'SQL'
            CREATE UNIQUE INDEX uniq_primary_email_per_user
                ON email_addresses (user_id)
                WHERE is_primary
            SQL);

        $this->addSql(<<<'SQL'
            CREATE UNIQUE INDEX uniq_primary_phone_per_user
                ON phone_numbers (user_id)
                WHERE is_primary
            SQL);

        $this->addSql(<<<'SQL'
            ALTER TABLE email_addresses
                ADD CONSTRAINT fk_email_address_user
                FOREIGN KEY (user_id) REFERENCES users (id)
                ON DELETE CASCADE NOT DEFERRABLE
            SQL);

        $this->addSql(<<<'SQL'
            ALTER TABLE phone_numbers
                ADD CONSTRAINT fk_phone_number_user
                FOREIGN KEY (user_id) REFERENCES users (id)
                ON DELETE CASCADE NOT DEFERRABLE
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE phone_numbers');
        $this->addSql('DROP TABLE email_addresses');
        $this->addSql('DROP TABLE users');
    }
}
