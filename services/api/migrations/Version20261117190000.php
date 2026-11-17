<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261117190000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A guest in a chair (sc-4013): one key per guest and one per chair, each per event, and the place a table, a row or a single seat.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE seat_assignments (
                id             UUID NOT NULL,
                event_id       UUID NOT NULL,
                plan_id        UUID NOT NULL,
                guest_id       UUID NOT NULL,
                table_id       UUID DEFAULT NULL,
                row_id         UUID DEFAULT NULL,
                single_seat_id UUID DEFAULT NULL,
                place_id       UUID NOT NULL,
                seat           SMALLINT NOT NULL,
                PRIMARY KEY (id),
                CONSTRAINT seat_assignment_one_place CHECK (num_nonnulls(table_id, row_id, single_seat_id) = 1),
                CONSTRAINT seat_assignment_seat_from_one CHECK (seat >= 1)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_seat_assignment_guest ON seat_assignments (event_id, guest_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_seat_assignment_chair ON seat_assignments (event_id, place_id, seat)');
        $this->addSql('CREATE INDEX IDX_15D1EBD7E899029B ON seat_assignments (plan_id)');
        $this->addSql('CREATE INDEX IDX_15D1EBD79A4AA658 ON seat_assignments (guest_id)');
        $this->addSql('CREATE INDEX IDX_15D1EBD7ECFF285C ON seat_assignments (table_id)');
        $this->addSql('CREATE INDEX IDX_15D1EBD783A269F2 ON seat_assignments (row_id)');
        $this->addSql('CREATE INDEX IDX_15D1EBD77BC0E376 ON seat_assignments (single_seat_id)');
        $this->addSql('ALTER TABLE seat_assignments ADD CONSTRAINT FK_SEAT_ASSIGNMENT_EVENT FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE seat_assignments ADD CONSTRAINT FK_SEAT_ASSIGNMENT_PLAN FOREIGN KEY (plan_id) REFERENCES seating_plans (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE seat_assignments ADD CONSTRAINT FK_SEAT_ASSIGNMENT_GUEST FOREIGN KEY (guest_id) REFERENCES guests (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE seat_assignments ADD CONSTRAINT FK_SEAT_ASSIGNMENT_TABLE FOREIGN KEY (table_id) REFERENCES seating_tables (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE seat_assignments ADD CONSTRAINT FK_SEAT_ASSIGNMENT_ROW FOREIGN KEY (row_id) REFERENCES seating_rows (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE seat_assignments ADD CONSTRAINT FK_SEAT_ASSIGNMENT_SINGLE_SEAT FOREIGN KEY (single_seat_id) REFERENCES seating_seats (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE seat_assignments');
    }
}
