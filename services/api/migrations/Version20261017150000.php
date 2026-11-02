<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Getting back in after losing both the authenticator and the recovery codes: the request, and the prompt to set two-factor up again.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE two_factor_recoveries (
                id                UUID NOT NULL,
                user_id           UUID NOT NULL,
                token_hash        VARCHAR(64) NOT NULL,
                email_address_id  UUID NOT NULL,
                phone_number_id   UUID DEFAULT NULL,
                status            VARCHAR(16) NOT NULL,
                proved_at         TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                expires_at        TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                closed_at         TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                decided_by_id     UUID DEFAULT NULL,
                created_at        TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at        TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_two_factor_recovery_hash ON two_factor_recoveries (token_hash)');
        $this->addSql('CREATE INDEX idx_two_factor_recovery_user ON two_factor_recoveries (user_id, created_at)');
        $this->addSql('CREATE INDEX idx_two_factor_recovery_status ON two_factor_recoveries (status, expires_at)');
        $this->addSql('CREATE INDEX IDX_EAF52FAD59045DAA ON two_factor_recoveries (email_address_id)');
        $this->addSql('CREATE INDEX IDX_EAF52FAD39DFD528 ON two_factor_recoveries (phone_number_id)');
        $this->addSql('CREATE INDEX IDX_EAF52FADE26B496B ON two_factor_recoveries (decided_by_id)');
        $this->addSql('ALTER TABLE two_factor_recoveries ADD CONSTRAINT FK_TWO_FACTOR_RECOVERY_USER FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE two_factor_recoveries ADD CONSTRAINT FK_TWO_FACTOR_RECOVERY_EMAIL FOREIGN KEY (email_address_id) REFERENCES email_addresses (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE two_factor_recoveries ADD CONSTRAINT FK_TWO_FACTOR_RECOVERY_PHONE FOREIGN KEY (phone_number_id) REFERENCES phone_numbers (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE two_factor_recoveries ADD CONSTRAINT FK_TWO_FACTOR_RECOVERY_DECIDED_BY FOREIGN KEY (decided_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE users ADD two_factor_setup_prompt BOOLEAN DEFAULT false NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE users DROP two_factor_setup_prompt');
        $this->addSql('DROP TABLE two_factor_recoveries');
    }
}
