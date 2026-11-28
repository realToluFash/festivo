<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261126180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A service\'s times are kept to the millisecond (sc-4005), as its writes answer and publish them, so a refetch reads what the patch said.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE service_firings ALTER fired_at TYPE TIMESTAMP(3) WITHOUT TIME ZONE');
        $this->addSql('ALTER TABLE service_items ALTER changed_at TYPE TIMESTAMP(3) WITHOUT TIME ZONE');
        $this->addSql('ALTER TABLE service_plates ALTER owed_at TYPE TIMESTAMP(3) WITHOUT TIME ZONE');
        $this->addSql('ALTER TABLE service_steps ALTER at TYPE TIMESTAMP(3) WITHOUT TIME ZONE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE service_firings ALTER fired_at TYPE TIMESTAMP(0) WITHOUT TIME ZONE');
        $this->addSql('ALTER TABLE service_items ALTER changed_at TYPE TIMESTAMP(0) WITHOUT TIME ZONE');
        $this->addSql('ALTER TABLE service_plates ALTER owed_at TYPE TIMESTAMP(0) WITHOUT TIME ZONE');
        $this->addSql('ALTER TABLE service_steps ALTER at TYPE TIMESTAMP(0) WITHOUT TIME ZONE');
    }
}
