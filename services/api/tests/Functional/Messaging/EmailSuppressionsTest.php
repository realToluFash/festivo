<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\EmailAddressHash;
use App\Domain\Messaging\EmailSuppressions;
use App\Enum\MailProviderReport;
use App\Tests\FunctionalTestCase;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Str;
use Psl\Vec;

final class EmailSuppressionsTest extends FunctionalTestCase
{
    #[Test]
    public function theListKeepsAKeyedHashOfTheAddressAndNeverTheAddress(): void
    {
        self::suppressions()->suppress(' Ada@Example.test ', MailProviderReport::Bounced);

        $rows = self::connection()->fetchAllAssociative('SELECT * FROM email_suppressions');

        self::assertCount(1, $rows);
        self::assertSame(['reason', 'suppressed_at', 'address_hash'], Vec\keys($rows[0]));
        self::assertSame('bounced', $rows[0]['reason']);
        self::assertFalse(Str\contains_ci(Json\encode($rows), 'ada@example.test'));
        self::assertNotSame(\hash('sha256', 'ada@example.test'), $rows[0]['address_hash'], 'an unkeyed hash of a guessable address is not pseudonymised');
        self::assertSame(self::service(EmailAddressHash::class)->of('ada@example.test'), $rows[0]['address_hash']);
    }

    #[Test]
    public function anAddressDifferingOnlyByCaseOrOuterSpacesIsStillStopped(): void
    {
        self::suppressions()->suppress('ada@example.test', MailProviderReport::Complained);

        self::assertTrue(self::suppressions()->isSuppressed('ADA@example.TEST'));
        self::assertTrue(self::suppressions()->isSuppressed("  ada@example.test\t"));
        self::assertFalse(self::suppressions()->isSuppressed('ada2@example.test'));
        self::assertSame(['ada@example.test'], self::suppressions()->suppressedAmong(['Ada@Example.test ', 'grace@example.test']));
    }

    #[Test]
    public function aComplaintOutranksABounceWhicheverCameFirst(): void
    {
        self::suppressions()->suppress('ada@example.test', MailProviderReport::Bounced);
        self::suppressions()->suppress('Ada@example.test', MailProviderReport::Complained);
        self::suppressions()->suppress('grace@example.test', MailProviderReport::Complained);
        self::suppressions()->suppress('grace@example.test', MailProviderReport::Bounced);

        self::assertSame(['complained', 'complained'], self::connection()->fetchFirstColumn('SELECT reason FROM email_suppressions'));
    }

    #[Test]
    public function liftingTheAddressRemovesItsRow(): void
    {
        self::suppressions()->suppress('ada@example.test', MailProviderReport::Bounced);

        self::suppressions()->lift('ADA@example.test');

        self::assertFalse(self::suppressions()->isSuppressed('ada@example.test'));
        self::assertSame(0, self::connection()->fetchOne('SELECT COUNT(*) FROM email_suppressions'));
    }

    private static function suppressions(): EmailSuppressions
    {
        return self::service(EmailSuppressions::class);
    }

    private static function connection(): Connection
    {
        return self::service(Connection::class);
    }
}
