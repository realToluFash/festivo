<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261125191957 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Guest messages (sc-3942): each organisation keeps a keyed hash of every address its guests reported as spam, under its own key. Written when the complaint lands, so neither a removal nor an event purge lifts it.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE guest_complaints (
                address_hash     VARCHAR(64) NOT NULL,
                organisation_id  UUID NOT NULL,
                PRIMARY KEY (organisation_id, address_hash)
            )
            SQL);
        $this->addSql('CREATE INDEX IDX_9D42FFAB9E6B1585 ON guest_complaints (organisation_id)');
        $this->addSql('ALTER TABLE guest_complaints ADD CONSTRAINT FK_9D42FFAB9E6B1585 FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE guest_complaints');
    }
}
