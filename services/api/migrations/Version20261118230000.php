<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261118230000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Someone from outside the organisation on an event (sc-71): held by their account, or by the address they were added by.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE event_people
                ALTER membership_id DROP NOT NULL,
                ADD user_id       UUID DEFAULT NULL,
                ADD address       VARCHAR(320) DEFAULT NULL,
                ADD address_kind  VARCHAR(10) DEFAULT NULL,
                ADD granted_by_id UUID DEFAULT NULL
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE event_people ADD CONSTRAINT chk_event_person_one_holder CHECK (
                (membership_id IS NOT NULL)::int + (user_id IS NOT NULL)::int + (address IS NOT NULL)::int = 1
                AND (address IS NULL) = (address_kind IS NULL)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_event_person_user ON event_people (event_id, user_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_event_person_address ON event_people (event_id, address)');
        $this->addSql('CREATE INDEX idx_event_person_user ON event_people (user_id)');
        $this->addSql('CREATE INDEX idx_event_person_address ON event_people (address)');
        $this->addSql('CREATE INDEX IDX_1A8F1D743151C11F ON event_people (granted_by_id)');
        $this->addSql('ALTER TABLE event_people ADD CONSTRAINT FK_1A8F1D74A76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE event_people ADD CONSTRAINT FK_1A8F1D743151C11F FOREIGN KEY (granted_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->throwIrreversibleMigrationException('A grant to someone from outside has no membership to fall back to.');
    }
}
