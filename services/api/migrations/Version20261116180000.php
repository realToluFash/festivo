<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261116180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Each Done, Start now and Skip on the night screen kept as a press with its idempotency key, and an item can be skipped (sc-3895). Items already marked get the presses that mark them.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE schedule_presses (
                id               UUID NOT NULL,
                event_id         UUID NOT NULL,
                item_id          UUID NOT NULL,
                kind             VARCHAR(8) NOT NULL,
                pressed_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                idempotency_key  VARCHAR(255) NOT NULL,
                fingerprint      VARCHAR(64) NOT NULL,
                pressed_by_id    UUID DEFAULT NULL,
                pressed_by_name  VARCHAR(480) NOT NULL,
                answer           VARCHAR(40) DEFAULT NULL,
                created_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_schedule_press_event ON schedule_presses (event_id, pressed_at)');
        $this->addSql('CREATE UNIQUE INDEX uniq_schedule_press_key ON schedule_presses (pressed_by_id, idempotency_key)');
        $this->addSql('CREATE INDEX IDX_15ED110C71F7E88B ON schedule_presses (event_id)');
        $this->addSql('CREATE INDEX IDX_15ED110C126F525E ON schedule_presses (item_id)');
        $this->addSql('CREATE INDEX IDX_15ED110CFECD758E ON schedule_presses (pressed_by_id)');
        $this->addSql('ALTER TABLE schedule_presses ADD CONSTRAINT FK_15ED110C71F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE schedule_presses ADD CONSTRAINT FK_15ED110C126F525E FOREIGN KEY (item_id) REFERENCES schedule_items (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE schedule_presses ADD CONSTRAINT FK_15ED110CFECD758E FOREIGN KEY (pressed_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE schedule_items ADD skipped BOOLEAN DEFAULT false NOT NULL');
        $this->addSql(<<<'SQL'
            INSERT INTO schedule_presses (id, event_id, item_id, kind, pressed_at, idempotency_key, fingerprint, pressed_by_id, pressed_by_name, created_at, updated_at)
            SELECT gen_random_uuid(), i.event_id, i.id, 'start', i.started_at, gen_random_uuid()::text, '', NULL, '', NOW(), NOW()
              FROM schedule_items i
             WHERE i.started_at IS NOT NULL
            SQL);
        $this->addSql(<<<'SQL'
            INSERT INTO schedule_presses (id, event_id, item_id, kind, pressed_at, idempotency_key, fingerprint, pressed_by_id, pressed_by_name, created_at, updated_at)
            SELECT gen_random_uuid(), i.event_id, i.id, 'done', i.ended_at, gen_random_uuid()::text, '', NULL, '', NOW(), NOW()
              FROM schedule_items i
             WHERE i.ended_at IS NOT NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE schedule_presses');
        $this->addSql('ALTER TABLE schedule_items DROP skipped');
    }
}
