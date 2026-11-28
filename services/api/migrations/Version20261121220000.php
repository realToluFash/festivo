<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261121220000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Guest replies (sc-4331): what a guest did that the event\'s members hear of, and when each member last looked. Nothing before them is told, so both start empty.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE guest_reply_changes (
                id         UUID NOT NULL,
                event_id   UUID NOT NULL,
                guest_id   UUID NOT NULL,
                kind       VARCHAR(16) NOT NULL,
                answer     VARCHAR(16) DEFAULT NULL,
                created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_guest_reply_change_event ON guest_reply_changes (event_id, created_at)');
        $this->addSql('CREATE INDEX IDX_6898C60771F7E88B ON guest_reply_changes (event_id)');
        $this->addSql('CREATE INDEX IDX_6898C6079A4AA658 ON guest_reply_changes (guest_id)');
        $this->addSql('ALTER TABLE guest_reply_changes ADD CONSTRAINT FK_6898C60771F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE guest_reply_changes ADD CONSTRAINT FK_6898C6079A4AA658 FOREIGN KEY (guest_id) REFERENCES guests (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE guest_reply_looks (
                id        UUID NOT NULL,
                user_id   UUID NOT NULL,
                event_id  UUID NOT NULL,
                looked_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_guest_reply_look ON guest_reply_looks (user_id, event_id)');
        $this->addSql('CREATE INDEX IDX_BDF4147DA76ED395 ON guest_reply_looks (user_id)');
        $this->addSql('CREATE INDEX IDX_BDF4147D71F7E88B ON guest_reply_looks (event_id)');
        $this->addSql('ALTER TABLE guest_reply_looks ADD CONSTRAINT FK_BDF4147DA76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE guest_reply_looks ADD CONSTRAINT FK_BDF4147D71F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE guest_reply_looks');
        $this->addSql('DROP TABLE guest_reply_changes');
    }
}
