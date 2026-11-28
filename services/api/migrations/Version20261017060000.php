<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017060000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'The emailed code a Google or Apple account proves its address with before it adds a password.';
    }

    public function up(Schema $schema): void
    {
        // A new table: no account has ever added a password this way before it.
        $this->addSql(<<<'SQL'
            CREATE TABLE password_set_codes (
                id               UUID NOT NULL,
                user_id          UUID NOT NULL,
                code_hash        VARCHAR(64) NOT NULL,
                code_expires_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                code_sent_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                attempts         INT NOT NULL,
                passed_at        TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                step_up_hash     VARCHAR(64) DEFAULT NULL,
                created_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_password_set_code_user ON password_set_codes (user_id)');
        $this->addSql('ALTER TABLE password_set_codes ADD CONSTRAINT FK_password_set_codes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE password_set_codes');
    }
}
