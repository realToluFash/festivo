<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261127170000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'The numbers that texted STOP to Soirely\'s number, which stops every organisation\'s texts to them, and the organisations a guest has since switched back on (sc-3946).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE text_stops (
                address_hash  VARCHAR(64) NOT NULL,
                stopped_at    TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (address_hash)
            )
            SQL);
        $this->addSql(<<<'SQL'
            CREATE TABLE text_stop_lifts (
                organisation_id  UUID NOT NULL,
                address_hash     VARCHAR(64) NOT NULL,
                PRIMARY KEY (organisation_id, address_hash)
            )
            SQL);
        $this->addSql('CREATE INDEX IDX_TEXT_STOP_LIFTS_ORGANISATION ON text_stop_lifts (organisation_id)');
        $this->addSql('ALTER TABLE text_stop_lifts ADD CONSTRAINT FK_TEXT_STOP_LIFTS_ORGANISATION FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE text_stop_lifts');
        $this->addSql('DROP TABLE text_stops');
    }
}
