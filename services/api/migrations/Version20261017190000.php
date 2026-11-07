<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017190000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'The devices each account has signed in on, so a sign-in from a new one is emailed (sc-511).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE known_devices (
                id             UUID NOT NULL,
                user_id        UUID NOT NULL,
                device_hash    VARCHAR(64) NOT NULL,
                first_seen_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                notified_at    TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_known_device ON known_devices (user_id, device_hash)');
        $this->addSql('CREATE INDEX idx_known_device_notified ON known_devices (user_id, notified_at)');
        $this->addSql('ALTER TABLE known_devices ADD CONSTRAINT FK_KNOWN_DEVICE_USER FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE known_devices');
    }
}
