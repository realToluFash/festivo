<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261117170000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'The items on a plate of an event\'s dish, and a course\'s own items served with it (sc-34230).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE menu_dishes ADD items JSON DEFAULT \'[]\' NOT NULL');
        $this->addSql('ALTER TABLE menu_courses ADD own_items JSON DEFAULT \'[]\' NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE menu_dishes DROP items');
        $this->addSql('ALTER TABLE menu_courses DROP own_items');
    }
}
