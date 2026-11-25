<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261125230000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'One list of the addresses an organisation no longer reaches, per channel (sc-3969): guest_complaints becomes guest_suppressions, each complaint kept as an email suppression with its hash as it was, and the guest\'s own opt-outs join it. email_soft_bounces counts the soft bounces in a row to an address.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE guest_suppressions (
                organisation_id  UUID NOT NULL,
                channel          VARCHAR(10) NOT NULL,
                address_hash     VARCHAR(64) NOT NULL,
                reason           VARCHAR(20) NOT NULL,
                suppressed_at    TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (organisation_id, channel, address_hash)
            )
            SQL);
        $this->addSql('CREATE INDEX IDX_9147B8C49E6B1585 ON guest_suppressions (organisation_id)');
        $this->addSql('ALTER TABLE guest_suppressions ADD CONSTRAINT FK_9147B8C49E6B1585 FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql(<<<'SQL'
            INSERT INTO guest_suppressions (organisation_id, channel, address_hash, reason, suppressed_at)
            SELECT organisation_id, 'email', address_hash, 'complained', NOW()
            FROM   guest_complaints
            SQL);
        $this->addSql('DROP TABLE guest_complaints');
        $this->addSql(<<<'SQL'
            CREATE TABLE email_soft_bounces (
                address_hash  VARCHAR(64) NOT NULL,
                in_a_row      INT NOT NULL,
                PRIMARY KEY (address_hash)
            )
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE email_soft_bounces');
        $this->addSql(<<<'SQL'
            CREATE TABLE guest_complaints (
                address_hash     VARCHAR(64) NOT NULL,
                organisation_id  UUID NOT NULL,
                PRIMARY KEY (organisation_id, address_hash)
            )
            SQL);
        $this->addSql('CREATE INDEX IDX_9D42FFAB9E6B1585 ON guest_complaints (organisation_id)');
        $this->addSql('ALTER TABLE guest_complaints ADD CONSTRAINT FK_9D42FFAB9E6B1585 FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql(<<<'SQL'
            INSERT INTO guest_complaints (organisation_id, address_hash)
            SELECT organisation_id, address_hash
            FROM   guest_suppressions
            WHERE  reason = 'complained'
            SQL);
        $this->addSql('DROP TABLE guest_suppressions');
    }
}
