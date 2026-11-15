<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261113190000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A guest\'s Language as the host set it, and the language the guest chose on their own page (sc-3790). Both start unset.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests ADD language VARCHAR(8) DEFAULT NULL');
        $this->addSql('ALTER TABLE guests ADD chosen_language VARCHAR(8) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests DROP language');
        $this->addSql('ALTER TABLE guests DROP chosen_language');
    }
}
