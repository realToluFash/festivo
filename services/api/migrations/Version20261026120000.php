<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261026120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An event has a venue: a name, an address, and the address\'s parts when it was picked (sc-3589). Every event so far has none, and shows "Venue to be confirmed".';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE events
                ADD venue_name         VARCHAR(120) DEFAULT NULL,
                ADD venue_address      VARCHAR(300) DEFAULT NULL,
                ADD venue_line1        VARCHAR(255) DEFAULT NULL,
                ADD venue_line2        VARCHAR(255) DEFAULT NULL,
                ADD venue_city         VARCHAR(255) DEFAULT NULL,
                ADD venue_region       VARCHAR(255) DEFAULT NULL,
                ADD venue_postal_code  VARCHAR(32) DEFAULT NULL,
                ADD venue_country_code VARCHAR(2) DEFAULT NULL,
                ADD venue_latitude     DOUBLE PRECISION DEFAULT NULL,
                ADD venue_longitude    DOUBLE PRECISION DEFAULT NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE events
                DROP venue_name,
                DROP venue_address,
                DROP venue_line1,
                DROP venue_line2,
                DROP venue_city,
                DROP venue_region,
                DROP venue_postal_code,
                DROP venue_country_code,
                DROP venue_latitude,
                DROP venue_longitude
            SQL);
    }
}
