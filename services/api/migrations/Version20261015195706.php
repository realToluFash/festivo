<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261015195706 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A verification challenge is a row: the hashed code, its expiry, its attempts, and what it is for.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE verification_challenges (
                id               UUID NOT NULL,
                channel          VARCHAR(10) NOT NULL,
                email_address_id UUID DEFAULT NULL,
                phone_number_id  UUID DEFAULT NULL,
                code_hash        VARCHAR(64) NOT NULL,
                expires_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                attempts         INT NOT NULL,
                revoked_at       TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);

        $this->addSql('CREATE INDEX idx_verification_challenge_email ON verification_challenges (email_address_id)');
        $this->addSql('CREATE INDEX idx_verification_challenge_phone ON verification_challenges (phone_number_id)');

        $this->addSql(<<<'SQL'
            ALTER TABLE verification_challenges
                ADD CONSTRAINT FK_9C222DEE59045DAA FOREIGN KEY (email_address_id)
                REFERENCES email_addresses (id) ON DELETE CASCADE NOT DEFERRABLE
            SQL);

        $this->addSql(<<<'SQL'
            ALTER TABLE verification_challenges
                ADD CONSTRAINT FK_9C222DEE39DFD528 FOREIGN KEY (phone_number_id)
                REFERENCES phone_numbers (id) ON DELETE CASCADE NOT DEFERRABLE
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE verification_challenges');
    }
}
