<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;
use Psl\Str;
use Psl\Type;

final class Version20261125200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'The account-wide email stop list (sc-93044) keeps the keyed hash of each address, never the address: every address already on it is hashed under APP_SECRET as EmailAddressHash does, its reason and date kept.';
    }

    public function up(Schema $schema): void
    {
        $addresses = Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn('SELECT address FROM email_suppressions'));
        $secret = Type\string()->coerce($_SERVER['APP_SECRET'] ?? $_ENV['APP_SECRET'] ?? '');
        $this->abortIf([] !== $addresses && '' === $secret, 'APP_SECRET is not set, and the stop list holds addresses to hash under it.');

        $this->addSql('ALTER TABLE email_suppressions ADD address_hash VARCHAR(64) DEFAULT NULL');

        foreach ($addresses as $address) {
            $this->addSql(<<<'SQL'
                UPDATE email_suppressions
                SET    address_hash = :hash
                WHERE  address = :address
                SQL, [
                'hash' => \hash_hmac('sha256', 'email-address:' . Str\lowercase(Str\trim($address)), $secret),
                'address' => $address,
            ]);
        }

        $this->addSql('ALTER TABLE email_suppressions DROP CONSTRAINT email_suppressions_pkey');
        $this->addSql('ALTER TABLE email_suppressions DROP address');
        $this->addSql('ALTER TABLE email_suppressions ALTER address_hash SET NOT NULL');
        $this->addSql('ALTER TABLE email_suppressions ADD PRIMARY KEY (address_hash)');
    }

    public function down(Schema $schema): void
    {
        $this->throwIrreversibleMigrationException('The addresses are gone: a keyed hash cannot be turned back into one.');
    }
}
