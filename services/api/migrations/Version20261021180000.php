<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261021180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Requests to join (sc-562): an organisation\'s request link, and the message a request carries.';
    }

    public function up(Schema $schema): void
    {
        // Both nullable with no backfill: every organisation starts with the link off, and no request has a message.
        $this->addSql('ALTER TABLE organisations ADD request_link_token VARCHAR(32) DEFAULT NULL');
        $this->addSql('CREATE UNIQUE INDEX uniq_organisation_request_link_token ON organisations (request_link_token)');
        $this->addSql('ALTER TABLE memberships ADD request_message VARCHAR(500) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE memberships DROP request_message');
        $this->addSql('DROP INDEX uniq_organisation_request_link_token');
        $this->addSql('ALTER TABLE organisations DROP request_link_token');
    }
}
