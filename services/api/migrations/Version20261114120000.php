<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261114120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A guest\'s and each companion\'s needs (sc-3777): codes as rows erased with their guest, each Other\'s words and the private note beside the guest. Nobody has recorded any yet, so nothing is backfilled.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE guest_needs (
                id       UUID NOT NULL,
                guest_id UUID NOT NULL,
                kind     VARCHAR(16) NOT NULL,
                code     VARCHAR(32) NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX IDX_7FA729FA9A4AA658 ON guest_needs (guest_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_guest_need ON guest_needs (guest_id, kind, code)');
        $this->addSql('ALTER TABLE guest_needs ADD CONSTRAINT FK_7FA729FA9A4AA658 FOREIGN KEY (guest_id) REFERENCES guests (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql(<<<'SQL'
            ALTER TABLE guests
                ADD other_allergy VARCHAR(100) DEFAULT NULL,
                ADD other_diet VARCHAR(100) DEFAULT NULL,
                ADD other_access VARCHAR(100) DEFAULT NULL,
                ADD needs_note TEXT DEFAULT NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE guest_needs');
        $this->addSql(<<<'SQL'
            ALTER TABLE guests
                DROP other_allergy,
                DROP other_diet,
                DROP other_access,
                DROP needs_note
            SQL);
    }
}
