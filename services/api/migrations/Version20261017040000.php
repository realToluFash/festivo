<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017040000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A password sign-up waiting on its emailed code, before any account exists.';
    }

    public function up(Schema $schema): void
    {
        // A new table: until now a sign-up created its account at once.
        $this->addSql(<<<'SQL'
            CREATE TABLE pending_registrations (
                id                             UUID NOT NULL,
                handle_hash                    VARCHAR(64) NOT NULL,
                email                          VARCHAR(180) NOT NULL,
                name                           VARCHAR(255) NOT NULL,
                password_hash                  VARCHAR(255) DEFAULT NULL,
                locale                         VARCHAR(8) DEFAULT NULL,
                for_taken_address              BOOLEAN NOT NULL,
                code_hash                      VARCHAR(64) NOT NULL,
                code_expires_at                TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                attempts                       INT NOT NULL,
                code_sent_at                   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                already_registered_emailed_at  TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                expires_at                     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                created_at                     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at                     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_pending_registration_handle ON pending_registrations (handle_hash)');
        $this->addSql('CREATE INDEX idx_pending_registration_email ON pending_registrations (email)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE pending_registrations');
    }
}
