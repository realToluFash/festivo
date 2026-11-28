<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261112210000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An event\'s guest list: each guest\'s full name as typed, their optional email address and mobile number, their reply, and each companion as a guest of their own under their host (sc-1468). No event has a guest yet.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE guests (
                id           UUID NOT NULL,
                event_id     UUID NOT NULL,
                host_id      UUID DEFAULT NULL,
                full_name    VARCHAR(200) DEFAULT NULL,
                name_key     VARCHAR(800) DEFAULT NULL,
                email        VARCHAR(254) DEFAULT NULL,
                mobile       VARCHAR(20) DEFAULT NULL,
                reply        VARCHAR(16) DEFAULT NULL,
                position     SMALLINT DEFAULT 0 NOT NULL,
                added_by_id  UUID DEFAULT NULL,
                created_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX IDX_4D11BCB271F7E88B ON guests (event_id)');
        $this->addSql('CREATE INDEX IDX_4D11BCB21FB8D185 ON guests (host_id)');
        $this->addSql('CREATE INDEX IDX_4D11BCB255B127A4 ON guests (added_by_id)');
        $this->addSql('ALTER TABLE guests ADD CONSTRAINT FK_4D11BCB271F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE guests ADD CONSTRAINT FK_4D11BCB21FB8D185 FOREIGN KEY (host_id) REFERENCES guests (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE guests ADD CONSTRAINT FK_4D11BCB255B127A4 FOREIGN KEY (added_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE guests');
    }
}
