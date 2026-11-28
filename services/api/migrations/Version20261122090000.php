<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261122090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Each guest\'s check-in code (sc-1301): 256 random bits (244 for guests backfilled here), apart from the invitation link, held by every guest who has a link and by nobody else. Guests already listed get theirs here.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests ADD check_in_code VARCHAR(43) DEFAULT NULL');
        $this->addSql(<<<'SQL'
            UPDATE guests
            SET    check_in_code = rtrim(translate(encode(decode(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex'), 'base64'), '+/', '-_'), '=')
            WHERE  link_token IS NOT NULL
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_guest_check_in_code ON guests (check_in_code)');
        $this->addSql('ALTER TABLE guests ADD CONSTRAINT guests_check_in_code_with_a_link CHECK ((link_token IS NOT NULL) = (check_in_code IS NOT NULL))');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests DROP CONSTRAINT guests_check_in_code_with_a_link');
        $this->addSql('DROP INDEX uniq_guest_check_in_code');
        $this->addSql('ALTER TABLE guests DROP check_in_code');
    }
}
