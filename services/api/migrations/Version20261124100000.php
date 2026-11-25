<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261124100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Staff sign in by phone code (sc-4235): a number signing in holds its code before any account exists; a roster entry links to the account it signed in; a browser session opened that way ends with the account\'s grants.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE phone_sign_ins (
                id              UUID NOT NULL,
                handle_hash     VARCHAR(64) NOT NULL,
                number          VARCHAR(32) NOT NULL,
                country_code    VARCHAR(2) DEFAULT NULL,
                staff_member_id UUID DEFAULT NULL,
                door_code_id    UUID DEFAULT NULL,
                typed_name      VARCHAR(720) DEFAULT NULL,
                locale          VARCHAR(8) NOT NULL,
                codes_by_text   BOOLEAN DEFAULT false NOT NULL,
                proved_at       TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                open_until      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                created_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id),
                CONSTRAINT phone_sign_in_one_way_in CHECK (num_nonnulls(staff_member_id, door_code_id) = 1)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_phone_sign_in_handle ON phone_sign_ins (handle_hash)');
        $this->addSql('CREATE INDEX idx_phone_sign_in_number ON phone_sign_ins (number)');
        $this->addSql('CREATE INDEX IDX_447D2C1A44DB03B1 ON phone_sign_ins (staff_member_id)');
        $this->addSql('CREATE INDEX IDX_447D2C1A5BA4874B ON phone_sign_ins (door_code_id)');
        $this->addSql('ALTER TABLE phone_sign_ins ADD CONSTRAINT FK_447D2C1A44DB03B1 FOREIGN KEY (staff_member_id) REFERENCES staff_members (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE phone_sign_ins ADD CONSTRAINT FK_447D2C1A5BA4874B FOREIGN KEY (door_code_id) REFERENCES door_codes (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql('ALTER TABLE verification_challenges ADD phone_sign_in_id UUID DEFAULT NULL');
        $this->addSql('ALTER TABLE verification_challenges ADD CONSTRAINT FK_9C222DEEC9B0A91 FOREIGN KEY (phone_sign_in_id) REFERENCES phone_sign_ins (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('CREATE INDEX idx_verification_challenge_phone_sign_in ON verification_challenges (phone_sign_in_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_live_challenge_per_phone_sign_in ON verification_challenges (phone_sign_in_id) WHERE (revoked_at IS NULL)');
        $this->addSql('ALTER TABLE verification_challenges ADD CONSTRAINT verification_challenge_one_subject CHECK (num_nonnulls(email_address_id, phone_number_id, phone_sign_in_id) = 1)');

        $this->addSql('ALTER TABLE staff_members ADD account_id UUID DEFAULT NULL');
        $this->addSql('ALTER TABLE staff_members ADD CONSTRAINT FK_1916C5499B6B5FBA FOREIGN KEY (account_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('CREATE INDEX IDX_1916C5499B6B5FBA ON staff_members (account_id)');

        $this->addSql('ALTER TABLE refresh_tokens ADD ends_with_grants BOOLEAN DEFAULT false NOT NULL');
        $this->addSql('ALTER TABLE two_factor_challenges ADD phone_sign_in_id UUID DEFAULT NULL');
        $this->addSql('ALTER TABLE two_factor_challenges ADD CONSTRAINT FK_1207DB1CC9B0A91 FOREIGN KEY (phone_sign_in_id) REFERENCES phone_sign_ins (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('CREATE INDEX IDX_1207DB1CC9B0A91 ON two_factor_challenges (phone_sign_in_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE two_factor_challenges DROP CONSTRAINT FK_1207DB1CC9B0A91');
        $this->addSql('DROP INDEX IDX_1207DB1CC9B0A91');
        $this->addSql('ALTER TABLE two_factor_challenges DROP phone_sign_in_id');
        $this->addSql('ALTER TABLE refresh_tokens DROP ends_with_grants');
        $this->addSql('ALTER TABLE staff_members DROP CONSTRAINT FK_1916C5499B6B5FBA');
        $this->addSql('DROP INDEX IDX_1916C5499B6B5FBA');
        $this->addSql('ALTER TABLE staff_members DROP account_id');
        $this->addSql('ALTER TABLE verification_challenges DROP CONSTRAINT verification_challenge_one_subject');
        $this->addSql('DROP INDEX uniq_live_challenge_per_phone_sign_in');
        $this->addSql('DROP INDEX idx_verification_challenge_phone_sign_in');
        $this->addSql('ALTER TABLE verification_challenges DROP CONSTRAINT FK_9C222DEEC9B0A91');
        $this->addSql('ALTER TABLE verification_challenges DROP phone_sign_in_id');
        $this->addSql('DROP TABLE phone_sign_ins');
    }
}
