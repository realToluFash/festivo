<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261026160000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An event can have a cover photo, with its position in a 16:9 frame and a description (sc-3590).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE event_covers (
                event_id     UUID NOT NULL,
                photo_key    VARCHAR(200) NOT NULL,
                position     SMALLINT NOT NULL,
                description  VARCHAR(250) DEFAULT NULL,
                created_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (event_id)
            )
            SQL);
        $this->addSql('ALTER TABLE event_covers ADD CONSTRAINT FK_C21486E071F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE event_covers');
    }
}
