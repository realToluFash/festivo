<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261127130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'When the kitchen sheet first differed from its latest copy (sc-30692).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE kitchen_final_numbers
                ADD differs_since TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE kitchen_final_numbers DROP differs_since');
    }
}
