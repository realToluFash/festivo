<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261116110000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A table name holds 30 letters as a reader counts them, up to 120 code points (sc-4000, pm 15 Nov 2026).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE seating_tables ALTER name TYPE VARCHAR(120)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE seating_tables ALTER name TYPE VARCHAR(30)');
    }
}
