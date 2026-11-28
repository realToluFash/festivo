<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\Messaging\EmailSuppressions;
use App\Enum\MailProviderReport;
use App\Tests\FunctionalTestCase;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Attributes\Test;
use Psl\Type;

/** The stop list is hashed under GUEST_COMPLAINT_KEY alone (sc-93364): a new APP_SECRET keeps every address stopped, a new GUEST_COMPLAINT_KEY recognises none. */
final class EmailSuppressionKeyTest extends FunctionalTestCase
{
    /** @var array<string, string> */
    private array $configured = [];

    protected function setUp(): void
    {
        foreach (['APP_SECRET', 'GUEST_COMPLAINT_KEY'] as $name) {
            $this->configured[$name] = Type\string()->coerce($_ENV[$name] ?? '');
        }
        parent::setUp();
    }

    protected function tearDown(): void
    {
        foreach ($this->configured as $name => $value) {
            self::set($name, $value);
        }
        parent::tearDown();
    }

    #[Test]
    public function aNewAppSecretLeavesAStoppedAddressStoppedWithItsReasonAndDate(): void
    {
        self::service(EmailSuppressions::class)->suppress('ada@example.test', MailProviderReport::Complained);
        $before = self::connection()->fetchAllAssociative('SELECT * FROM email_suppressions');

        self::rebootWith('APP_SECRET', 'a-rotated-app-secret');

        self::assertTrue(self::service(EmailSuppressions::class)->isSuppressed(' Ada@example.test '));
        self::assertSame($before, self::connection()->fetchAllAssociative('SELECT * FROM email_suppressions'));
    }

    #[Test]
    public function aNewComplaintKeyRecognisesNoAddressStoppedUnderTheOld(): void
    {
        self::service(EmailSuppressions::class)->suppress('ada@example.test', MailProviderReport::Bounced);

        self::rebootWith('GUEST_COMPLAINT_KEY', 'another-complaint-key');

        self::assertFalse(self::service(EmailSuppressions::class)->isSuppressed('ada@example.test'));
    }

    private static function rebootWith(string $name, string $value): void
    {
        self::set($name, $value);
        self::ensureKernelShutdown();
        self::bootKernel();
    }

    private static function connection(): Connection
    {
        return self::service(Connection::class);
    }

    private static function set(string $name, string $value): void
    {
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}
