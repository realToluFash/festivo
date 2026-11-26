<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261126150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A host\'s message to guests keeps the Idempotency-Key it was sent with (sc-32077), once per sender and event, so a retried Send answers as the send that reached Soirely. Messages sent before have none.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guest_messages ADD request_key VARCHAR(100) DEFAULT NULL');
        $this->addSql('CREATE UNIQUE INDEX uniq_guest_message_request ON guest_messages (event_id, created_by_id, request_key)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX uniq_guest_message_request');
        $this->addSql('ALTER TABLE guest_messages DROP request_key');
    }
}
