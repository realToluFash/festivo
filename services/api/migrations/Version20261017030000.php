<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017030000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An Android sign-in with Apple, from its start to the one-time handle that returns it to the app.';
    }

    public function up(Schema $schema): void
    {
        // A new table: Android never signed in with Apple through the API before it.
        $this->addSql(<<<'SQL'
            CREATE TABLE apple_app_attempts (
                id                 UUID NOT NULL,
                state_hash         VARCHAR(64) NOT NULL,
                code_challenge     VARCHAR(128) NOT NULL,
                expires_at         TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                code               TEXT DEFAULT NULL,
                apple_user         TEXT DEFAULT NULL,
                handle_hash        VARCHAR(64) DEFAULT NULL,
                handle_expires_at  TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                used_at            TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at         TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at         TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_apple_app_attempt_state ON apple_app_attempts (state_hash)');
        $this->addSql('CREATE UNIQUE INDEX uniq_apple_app_attempt_handle ON apple_app_attempts (handle_hash)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE apple_app_attempts');
    }
}
