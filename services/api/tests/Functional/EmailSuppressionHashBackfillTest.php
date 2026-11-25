<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Messaging\EmailAddressHash;
use App\Domain\Messaging\EmailSuppressions;
use App\Entity\EmailSuppression;
use App\Enum\MailProviderReport;
use App\Tests\FunctionalTestCase;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\DependencyFactory;
use Doctrine\Migrations\Version\Version;
use PHPUnit\Framework\Attributes\Test;
use Psl\Dict;
use Psl\Type;

final class EmailSuppressionHashBackfillTest extends FunctionalTestCase
{
    private const string MIGRATION = 'DoctrineMigrations\Version20261125200000';

    #[Test]
    public function anAddressStoppedBeforeTheHashIsStillStoppedWithItsReasonAndDate(): void
    {
        $connection = self::em()->getConnection();
        $connection->executeStatement('DELETE FROM email_suppressions');
        $connection->executeStatement('ALTER TABLE email_suppressions DROP CONSTRAINT email_suppressions_pkey');
        $connection->executeStatement('ALTER TABLE email_suppressions DROP address_hash');
        $connection->executeStatement('ALTER TABLE email_suppressions ADD address VARCHAR(320) NOT NULL');
        $connection->executeStatement('ALTER TABLE email_suppressions ADD PRIMARY KEY (address)');
        $connection->executeStatement(<<<'SQL'
            INSERT INTO email_suppressions (address, reason, suppressed_at) VALUES
                ('bounced@ire.events', 'bounced', '2026-11-14 09:30:00'),
                ('complained@ire.events', 'complained', '2026-11-20 18:05:00')
            SQL);
        $this->migrate();

        $suppressions = self::service(EmailSuppressions::class);
        self::assertTrue($suppressions->isSuppressed('bounced@ire.events'));
        self::assertTrue($suppressions->isSuppressed('  Complained@IRE.events '));
        self::assertFalse($suppressions->isSuppressed('someone.else@ire.events'));

        $hashes = self::em()->getConnection()->fetchFirstColumn('SELECT address_hash FROM email_suppressions');
        $key = Type\string()->coerce($_ENV['GUEST_COMPLAINT_KEY']);
        $appSecret = Type\string()->coerce($_ENV['APP_SECRET']);
        self::assertContains(new EmailAddressHash($key)->of('bounced@ire.events'), $hashes);
        self::assertNotContains(new EmailAddressHash($appSecret)->of('bounced@ire.events'), $hashes, 'no address is hashed under the app secret on the way');

        $kept = [];
        foreach (self::em()->getRepository(EmailSuppression::class)->findAll() as $row) {
            $kept[$row->getReason()->value] = $row->getSuppressedAt()->format('Y-m-d H:i:s');
        }
        self::assertSame([
            MailProviderReport::Bounced->value => '2026-11-14 09:30:00',
            MailProviderReport::Complained->value => '2026-11-20 18:05:00',
        ], Dict\sort_by_key($kept));
    }

    private function migrate(): void
    {
        $factory = self::serviceById('doctrine.migrations.dependency_factory', DependencyFactory::class);
        $migration = $factory->getMigrationRepository()->getMigration(new Version(self::MIGRATION))->getMigration();
        $migration->up(new Schema());

        foreach ($migration->getSql() as $query) {
            self::em()->getConnection()->executeStatement($query->getStatement(), Type\dict(Type\string(), Type\string())->coerce($query->getParameters()));
        }

        self::em()->clear();
    }
}
