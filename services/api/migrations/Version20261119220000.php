<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261119220000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Each person on the staff has their own link (sc-3912): a token per delivery, kept as its hash, and how far the link got on the person.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE staff_link_tokens (
                id              UUID NOT NULL,
                staff_member_id UUID NOT NULL,
                token_hash      VARCHAR(64) NOT NULL,
                created_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX IDX_3AACE55344DB03B1 ON staff_link_tokens (staff_member_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_staff_link_token_hash ON staff_link_tokens (token_hash)');
        $this->addSql(<<<'SQL'
            ALTER TABLE staff_link_tokens
                ADD CONSTRAINT FK_3AACE55344DB03B1 FOREIGN KEY (staff_member_id) REFERENCES staff_members (id) ON DELETE CASCADE NOT DEFERRABLE
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE staff_members
                ADD link_status  VARCHAR(16) DEFAULT 'none' NOT NULL,
                ADD link_by_id   UUID DEFAULT NULL,
                ADD link_at      TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL
            SQL);
        $this->addSql('CREATE INDEX IDX_1916C54955C7CDA ON staff_members (link_by_id)');
        $this->addSql(<<<'SQL'
            ALTER TABLE staff_members
                ADD CONSTRAINT FK_1916C54955C7CDA FOREIGN KEY (link_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE staff_members DROP CONSTRAINT FK_1916C54955C7CDA');
        $this->addSql('DROP INDEX IDX_1916C54955C7CDA');
        $this->addSql(<<<'SQL'
            ALTER TABLE staff_members
                DROP link_status,
                DROP link_by_id,
                DROP link_at
            SQL);
        $this->addSql('DROP TABLE staff_link_tokens');
    }
}
