<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261115200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An event\'s roster: the people working it, without making them members (sc-3906). No event has one yet.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE staff_members (
                id                  UUID NOT NULL,
                event_id            UUID NOT NULL,
                full_name           VARCHAR(200) NOT NULL,
                mobile              VARCHAR(32) DEFAULT NULL,
                email               VARCHAR(180) DEFAULT NULL,
                member_id           UUID DEFAULT NULL,
                contacts_erased_at  TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at          TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at          TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_staff_member_mobile ON staff_members (event_id, mobile)');
        $this->addSql('CREATE INDEX IDX_1916C54971F7E88B ON staff_members (event_id)');
        $this->addSql('CREATE INDEX IDX_1916C5497597D3FE ON staff_members (member_id)');
        $this->addSql('ALTER TABLE staff_members ADD CONSTRAINT FK_1916C54971F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE staff_members ADD CONSTRAINT FK_1916C5497597D3FE FOREIGN KEY (member_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE staff_members');
    }
}
