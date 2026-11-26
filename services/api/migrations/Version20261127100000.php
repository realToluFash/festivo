<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261127100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Clocking in and out (sc-234): when each person on a shift actually started and stopped, with any correction kept beside what was recorded, and outliving the person\'s removal from the roster once they clocked in.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE shift_attendances (
                id                    UUID NOT NULL,
                shift_id              UUID NOT NULL,
                staff_member_id       UUID DEFAULT NULL,
                person_id             UUID NOT NULL,
                removed_name          VARCHAR(800) DEFAULT NULL,
                removed_pay           VARCHAR(16) DEFAULT NULL,
                removed_amount_minor  INT DEFAULT NULL,
                clocked_in_at         TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                clocked_out_at        TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                corrected_in_at       TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                in_corrected_by       VARCHAR(160) DEFAULT NULL,
                in_corrected_on       TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                corrected_out_at      TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                out_corrected_by      VARCHAR(160) DEFAULT NULL,
                out_corrected_on      TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_shift_attendance ON shift_attendances (shift_id, person_id)');
        $this->addSql('CREATE INDEX IDX_378E0DC6BB70BC0E ON shift_attendances (shift_id)');
        $this->addSql('CREATE INDEX IDX_378E0DC644DB03B1 ON shift_attendances (staff_member_id)');
        $this->addSql('ALTER TABLE shift_attendances ADD CONSTRAINT FK_378E0DC6BB70BC0E FOREIGN KEY (shift_id) REFERENCES staff_shifts (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE shift_attendances ADD CONSTRAINT FK_378E0DC644DB03B1 FOREIGN KEY (staff_member_id) REFERENCES staff_members (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE door_codes ADD shift_id UUID DEFAULT NULL');
        $this->addSql('ALTER TABLE door_codes ADD CONSTRAINT FK_14377D6EBB70BC0E FOREIGN KEY (shift_id) REFERENCES staff_shifts (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('CREATE INDEX IDX_14377D6EBB70BC0E ON door_codes (shift_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE door_codes DROP CONSTRAINT FK_14377D6EBB70BC0E');
        $this->addSql('DROP INDEX IDX_14377D6EBB70BC0E');
        $this->addSql('ALTER TABLE door_codes DROP shift_id');
        $this->addSql('DROP TABLE shift_attendances');
    }
}
