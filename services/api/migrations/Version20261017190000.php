<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017190000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A two-factor recovery request is held by a handle per device, so opening it on another device leaves this one\'s working.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE two_factor_recovery_handles (
                id           UUID NOT NULL,
                recovery_id  UUID NOT NULL,
                token_hash   VARCHAR(64) NOT NULL,
                created_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_two_factor_recovery_handle_hash ON two_factor_recovery_handles (token_hash)');
        $this->addSql('CREATE INDEX idx_two_factor_recovery_handle_recovery ON two_factor_recovery_handles (recovery_id)');
        $this->addSql('ALTER TABLE two_factor_recovery_handles ADD CONSTRAINT FK_TWO_FACTOR_RECOVERY_HANDLE_RECOVERY FOREIGN KEY (recovery_id) REFERENCES two_factor_recoveries (id) ON DELETE CASCADE NOT DEFERRABLE');
        // Each request's one handle so far becomes its first, so a device holding one keeps working.
        $this->addSql(<<<'SQL'
            INSERT INTO two_factor_recovery_handles (
                id,
                recovery_id,
                token_hash,
                created_at,
                updated_at
            )
            SELECT gen_random_uuid(), id, token_hash, created_at, updated_at
              FROM two_factor_recoveries
            SQL);
        $this->addSql('DROP INDEX uniq_two_factor_recovery_hash');
        $this->addSql('ALTER TABLE two_factor_recoveries DROP token_hash');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE two_factor_recoveries ADD token_hash VARCHAR(64) DEFAULT NULL');
        $this->addSql(<<<'SQL'
            UPDATE two_factor_recoveries r
               SET token_hash = (
                   SELECT h.token_hash
                     FROM two_factor_recovery_handles h
                    WHERE h.recovery_id = r.id
                    ORDER BY h.created_at DESC
                    LIMIT 1
               )
            SQL);
        $this->addSql('ALTER TABLE two_factor_recoveries ALTER token_hash SET NOT NULL');
        $this->addSql('CREATE UNIQUE INDEX uniq_two_factor_recovery_hash ON two_factor_recoveries (token_hash)');
        $this->addSql('DROP TABLE two_factor_recovery_handles');
    }
}
