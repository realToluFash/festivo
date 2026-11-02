<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261016220000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'The country a phone number was entered for, captured alongside its E.164 form.';
    }

    public function up(Schema $schema): void
    {
        // Nullable: no screen has saved a number yet, and a country cannot be read back from every number.
        $this->addSql('ALTER TABLE phone_numbers ADD country_code VARCHAR(2) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE phone_numbers DROP country_code');
    }
}
