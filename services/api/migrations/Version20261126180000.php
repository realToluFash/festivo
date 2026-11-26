<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261126180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Each service write by its Idempotency-Key (sc-4028), with the first answer, so a tap sent again changes nothing.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE service_taps (
                id              UUID NOT NULL,
                event_id        UUID NOT NULL,
                by_id           UUID NOT NULL,
                idempotency_key VARCHAR(255) NOT NULL,
                fingerprint     VARCHAR(64) NOT NULL,
                made_at         TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                status          SMALLINT NOT NULL,
                answer          JSON DEFAULT NULL,
                refused         JSON DEFAULT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_service_tap_key ON service_taps (by_id, idempotency_key)');
        $this->addSql('CREATE INDEX idx_service_tap_made ON service_taps (made_at)');
        $this->addSql('CREATE INDEX IDX_A47CA45C71F7E88B ON service_taps (event_id)');
        $this->addSql('CREATE INDEX IDX_A47CA45CAAE72004 ON service_taps (by_id)');
        $this->addSql('ALTER TABLE service_taps ADD CONSTRAINT FK_A47CA45C71F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE service_taps ADD CONSTRAINT FK_A47CA45CAAE72004 FOREIGN KEY (by_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE service_taps');
    }
}
