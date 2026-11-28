<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261019150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An organisation holds its sign-in rules: Google or Apple only, how long a sign-in lasts unused, and two-factor for its administrators.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE organisations
                ADD provider_sign_in_only          BOOLEAN DEFAULT false NOT NULL,
                ADD inactivity_timeout_days        INT DEFAULT NULL,
                ADD administrators_need_two_factor BOOLEAN DEFAULT false NOT NULL,
                ADD sign_in_rules_changed_at       TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE organisations
                DROP provider_sign_in_only,
                DROP inactivity_timeout_days,
                DROP administrators_need_two_factor,
                DROP sign_in_rules_changed_at
            SQL);
    }
}
