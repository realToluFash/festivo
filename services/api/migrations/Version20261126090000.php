<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261126090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A service (sc-4005): each course fired for a table, its items at their stations, every guest\'s plate and the trays that carry them, and the steps undo reverses.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE service_firings (
                id          UUID NOT NULL,
                event_id    UUID NOT NULL,
                course_id   UUID NOT NULL,
                table_key   VARCHAR(80) NOT NULL,
                fired_at    TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                fired_by_id UUID DEFAULT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_service_firing ON service_firings (course_id, table_key)');
        $this->addSql('CREATE INDEX IDX_F1B09A4571F7E88B ON service_firings (event_id)');
        $this->addSql('CREATE INDEX IDX_F1B09A45591CC992 ON service_firings (course_id)');
        $this->addSql('CREATE INDEX IDX_F1B09A4556AE826C ON service_firings (fired_by_id)');

        $this->addSql(<<<'SQL'
            CREATE TABLE service_items (
                id            UUID NOT NULL,
                event_id      UUID NOT NULL,
                course_id     UUID NOT NULL,
                item_key      VARCHAR(240) NOT NULL,
                state         VARCHAR(16) NOT NULL,
                ready_in      SMALLINT DEFAULT NULL,
                changed_at    TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                changed_by_id UUID DEFAULT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_service_item ON service_items (course_id, item_key)');
        $this->addSql('CREATE INDEX IDX_486C04AA71F7E88B ON service_items (event_id)');
        $this->addSql('CREATE INDEX IDX_486C04AA591CC992 ON service_items (course_id)');
        $this->addSql('CREATE INDEX IDX_486C04AA828AD0A0 ON service_items (changed_by_id)');

        $this->addSql(<<<'SQL'
            CREATE TABLE service_trays (
                id        UUID NOT NULL,
                event_id  UUID NOT NULL,
                course_id UUID NOT NULL,
                table_key VARCHAR(80) NOT NULL,
                waiter_id UUID NOT NULL,
                steps     JSON NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_service_tray_event ON service_trays (event_id)');
        $this->addSql('CREATE INDEX IDX_DCD077CC591CC992 ON service_trays (course_id)');
        $this->addSql('CREATE INDEX IDX_DCD077CCE9F3D07E ON service_trays (waiter_id)');

        $this->addSql(<<<'SQL'
            CREATE TABLE service_plates (
                id          UUID NOT NULL,
                event_id    UUID NOT NULL,
                course_id   UUID NOT NULL,
                guest_id    UUID NOT NULL,
                table_key   VARCHAR(80) NOT NULL,
                is_order    BOOLEAN NOT NULL,
                items       JSON NOT NULL,
                stage       VARCHAR(16) NOT NULL,
                tray_id     UUID DEFAULT NULL,
                marks       JSON NOT NULL,
                choice      VARCHAR(16) DEFAULT NULL,
                to_follow   JSON NOT NULL,
                steps       JSON NOT NULL,
                owed_reason VARCHAR(16) DEFAULT NULL,
                owed_at     TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                sent_back   JSON NOT NULL,
                order_id    UUID DEFAULT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_service_plate_course ON service_plates (course_id)');
        $this->addSql('CREATE INDEX idx_service_plate_table ON service_plates (event_id, table_key)');
        $this->addSql('CREATE UNIQUE INDEX uniq_service_order ON service_plates (course_id, guest_id) WHERE (is_order)');
        $this->addSql('CREATE INDEX IDX_D901DC9671F7E88B ON service_plates (event_id)');
        $this->addSql('CREATE INDEX IDX_D901DC969A4AA658 ON service_plates (guest_id)');
        $this->addSql('CREATE INDEX IDX_D901DC96E8C42A45 ON service_plates (tray_id)');
        $this->addSql('CREATE INDEX IDX_D901DC968D9F6D38 ON service_plates (order_id)');

        $this->addSql(<<<'SQL'
            CREATE TABLE service_steps (
                id       UUID NOT NULL,
                event_id UUID NOT NULL,
                kind     VARCHAR(40) NOT NULL,
                subjects JSON NOT NULL,
                before   JSON NOT NULL,
                made     JSON NOT NULL,
                by_id    UUID NOT NULL,
                at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                undone   BOOLEAN NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_service_step_event ON service_steps (event_id, at)');
        $this->addSql('CREATE INDEX IDX_9D50E79571F7E88B ON service_steps (event_id)');
        $this->addSql('CREATE INDEX IDX_9D50E795AAE72004 ON service_steps (by_id)');

        $this->addSql('ALTER TABLE service_firings ADD CONSTRAINT FK_F1B09A4571F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE service_firings ADD CONSTRAINT FK_F1B09A45591CC992 FOREIGN KEY (course_id) REFERENCES menu_courses (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE service_firings ADD CONSTRAINT FK_F1B09A4556AE826C FOREIGN KEY (fired_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE service_items ADD CONSTRAINT FK_486C04AA71F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE service_items ADD CONSTRAINT FK_486C04AA591CC992 FOREIGN KEY (course_id) REFERENCES menu_courses (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE service_items ADD CONSTRAINT FK_486C04AA828AD0A0 FOREIGN KEY (changed_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE service_trays ADD CONSTRAINT FK_DCD077CC71F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE service_trays ADD CONSTRAINT FK_DCD077CC591CC992 FOREIGN KEY (course_id) REFERENCES menu_courses (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE service_trays ADD CONSTRAINT FK_DCD077CCE9F3D07E FOREIGN KEY (waiter_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE service_plates ADD CONSTRAINT FK_D901DC9671F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE service_plates ADD CONSTRAINT FK_D901DC96591CC992 FOREIGN KEY (course_id) REFERENCES menu_courses (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE service_plates ADD CONSTRAINT FK_D901DC969A4AA658 FOREIGN KEY (guest_id) REFERENCES guests (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE service_plates ADD CONSTRAINT FK_D901DC96E8C42A45 FOREIGN KEY (tray_id) REFERENCES service_trays (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE service_plates ADD CONSTRAINT FK_D901DC968D9F6D38 FOREIGN KEY (order_id) REFERENCES service_plates (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE service_steps ADD CONSTRAINT FK_9D50E79571F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE service_steps ADD CONSTRAINT FK_9D50E795AAE72004 FOREIGN KEY (by_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE service_steps');
        $this->addSql('DROP TABLE service_plates');
        $this->addSql('DROP TABLE service_trays');
        $this->addSql('DROP TABLE service_items');
        $this->addSql('DROP TABLE service_firings');
    }
}
