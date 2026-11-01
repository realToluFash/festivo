<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\TwoFactor\SecretBox;
use App\Domain\User\UserRegistrar;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;

/** An environment that sets no TWO_FACTOR_KEY refuses two-factor work, and nothing else. */
final class TwoFactorKeyTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private string $configured = '';

    protected function setUp(): void
    {
        $this->configured = $_ENV['TWO_FACTOR_KEY'] ?? '';
        self::keyed('');
        parent::setUp();
    }

    protected function tearDown(): void
    {
        self::keyed($this->configured);
        parent::tearDown();
    }

    #[Test]
    public function passwordSignInStillWorksForAnAccountWithoutTwoFactor(): void
    {
        $user = self::service(UserRegistrar::class)->register('no-key@example.com', 'Bola', self::PASSWORD)->user;
        self::onboard($user);

        $this->client->request('POST', '/api/auth/login', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode([
            'email' => 'no-key@example.com',
            'password' => self::PASSWORD,
        ]));

        self::assertSame(200, $this->client->getResponse()->getStatusCode(), (string) $this->client->getResponse()->getContent());
    }

    #[Test]
    public function sealingASecretIsRefused(): void
    {
        $this->expectException(LogicException::class);

        self::service(SecretBox::class)->seal('JBSWY3DPEHPK3PXP');
    }

    private static function keyed(string $key): void
    {
        $_ENV['TWO_FACTOR_KEY'] = $key;
        $_SERVER['TWO_FACTOR_KEY'] = $key;
    }
}
