<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261114170000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A guest taken off the list and still inside their undo (sc-3774): off the list and the counts, erased once the undo runs out. Nobody could be removed before today, so nothing is backfilled.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE guests
                ADD removed_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                ADD removed_by_id UUID DEFAULT NULL
            SQL);
        $this->addSql('ALTER TABLE guests ADD CONSTRAINT FK_4D11BCB22BD701DA FOREIGN KEY (removed_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('CREATE INDEX IDX_4D11BCB22BD701DA ON guests (removed_by_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests DROP CONSTRAINT FK_4D11BCB22BD701DA');
        $this->addSql('DROP INDEX IDX_4D11BCB22BD701DA');
        $this->addSql(<<<'SQL'
            ALTER TABLE guests
                DROP removed_at,
                DROP removed_by_id
            SQL);
    }
}
