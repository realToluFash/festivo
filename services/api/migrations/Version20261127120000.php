<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261127120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Who\'s here (sc-3918): the lead who added someone at the door, and whom a person was moved to cover, from which station and when.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE staff_members
                ADD walk_on_by_id UUID DEFAULT NULL,
                ADD covering_id   UUID DEFAULT NULL,
                ADD moved_from    VARCHAR(240) DEFAULT NULL,
                ADD moved_at      TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL
            SQL);
        $this->addSql('ALTER TABLE staff_members ADD CONSTRAINT FK_1916C549E6798172 FOREIGN KEY (walk_on_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE staff_members ADD CONSTRAINT FK_1916C549D4108F8C FOREIGN KEY (covering_id) REFERENCES staff_members (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('CREATE INDEX IDX_1916C549E6798172 ON staff_members (walk_on_by_id)');
        $this->addSql('CREATE INDEX IDX_1916C549D4108F8C ON staff_members (covering_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE staff_members DROP CONSTRAINT FK_1916C549E6798172');
        $this->addSql('ALTER TABLE staff_members DROP CONSTRAINT FK_1916C549D4108F8C');
        $this->addSql('DROP INDEX IDX_1916C549E6798172');
        $this->addSql('DROP INDEX IDX_1916C549D4108F8C');
        $this->addSql(<<<'SQL'
            ALTER TABLE staff_members
                DROP walk_on_by_id,
                DROP covering_id,
                DROP moved_from,
                DROP moved_at
            SQL);
    }
}
