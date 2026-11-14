<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261113120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Each guest\'s invitation link: a token of 256 random bits, one per guest and none for a companion, and whether somebody holding it said it reached the wrong person (sc-1526). Guests already listed get theirs here.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests ADD link_token VARCHAR(43) DEFAULT NULL');
        $this->addSql('ALTER TABLE guests ADD link_flagged BOOLEAN DEFAULT false NOT NULL');
        // Two v4 UUIDs are 244 random bits from gen_random_uuid(), which needs no extension; base64url without padding is 43 characters.
        $this->addSql(<<<'SQL'
            UPDATE guests
            SET    link_token = rtrim(translate(encode(decode(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex'), 'base64'), '+/', '-_'), '=')
            WHERE  host_id IS NULL
            SQL);
        $this->addSql('CREATE UNIQUE INDEX UNIQ_4D11BCB2F08CFDE5 ON guests (link_token)');
        $this->addSql('ALTER TABLE guests ADD CONSTRAINT guests_link_only_for_a_guest CHECK ((host_id IS NULL) = (link_token IS NOT NULL))');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests DROP CONSTRAINT guests_link_only_for_a_guest');
        $this->addSql('DROP INDEX UNIQ_4D11BCB2F08CFDE5');
        $this->addSql('ALTER TABLE guests DROP link_token');
        $this->addSql('ALTER TABLE guests DROP link_flagged');
    }
}
