<?php

declare(strict_types=1);

namespace App\Tests\Functional\Messaging;

use App\Domain\User\UserRegistrar;
use App\Entity\User;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Psl\Json;
use Psl\Type;
use SensitiveParameter;

final class PushTargetsTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    /** An uncompressed P-256 point and a 16-byte secret, as a browser hands them over. */
    private const string P256DH = 'BAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0-P0A';

    private const string AUTH = 'AAECAwQFBgcICQoLDA0ODw';

    private const string ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';

    /** @mago-expect lint:no-literal-password a made-up token */
    private const string TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

    #[Test]
    public function aBrowserGetsTheKeyItSubscribesWith(): void
    {
        $this->account('key@example.com');
        $laptop = $this->signIn('key@example.com');

        $body = $this->request($laptop, 'GET', null);

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame(['webPushKey' => Type\string()->coerce($_ENV['VAPID_PUBLIC_KEY'] ?? $_SERVER['VAPID_PUBLIC_KEY'])], $body);
    }

    #[Test]
    public function eachDeviceIsRegisteredUnderItsOwnSession(): void
    {
        $this->account('both@example.com');
        $laptop = $this->signIn('both@example.com');
        $phone = $this->signIn('both@example.com');

        $this->request($laptop, 'PUT', ['kind' => 'web', 'address' => self::ENDPOINT, 'keys' => ['p256dh' => self::P256DH, 'auth' => self::AUTH]]);
        self::assertSame(204, $this->client->getResponse()->getStatusCode());
        $this->request($phone, 'PUT', ['kind' => 'expo', 'address' => self::TOKEN]);
        self::assertSame(204, $this->client->getResponse()->getStatusCode());

        self::assertSame(
            [
                ['kind' => 'web', 'address' => self::ENDPOINT, 'session_id' => $laptop['sessionId'], 'public_key' => self::P256DH, 'auth_secret' => self::AUTH],
                ['kind' => 'expo', 'address' => self::TOKEN, 'session_id' => $phone['sessionId'], 'public_key' => null, 'auth_secret' => null],
            ],
            $this->targets(),
        );
    }

    #[Test]
    public function signingOutOnADeviceForgetsItsPushAndKeepsTheOthers(): void
    {
        $this->account('out@example.com');
        $laptop = $this->signIn('out@example.com');
        $phone = $this->signIn('out@example.com');
        $this->request($laptop, 'PUT', ['kind' => 'web', 'address' => self::ENDPOINT, 'keys' => ['p256dh' => self::P256DH, 'auth' => self::AUTH]]);
        $this->request($phone, 'PUT', ['kind' => 'expo', 'address' => self::TOKEN]);

        $this->client->request('POST', '/api/auth/logout', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode([
            'refreshToken' => $phone['refreshToken'],
        ]));
        self::assertSame(204, $this->client->getResponse()->getStatusCode());

        self::assertSame([self::ENDPOINT], \array_column($this->targets(), 'address'));
    }

    #[Test]
    public function anAddressRegisteredAgainBelongsToWhoeverRegisteredItLast(): void
    {
        $first = $this->account('first@example.com');
        $second = $this->account('second@example.com');
        $this->request($this->signIn('first@example.com'), 'PUT', ['kind' => 'expo', 'address' => self::TOKEN]);

        $this->request($this->signIn('second@example.com'), 'PUT', ['kind' => 'expo', 'address' => self::TOKEN]);

        self::assertSame(
            [$second->getId()->toRfc4122()],
            self::service(Connection::class)->fetchFirstColumn('SELECT user_id FROM push_targets'),
            "{$first->getName()}'s phone is now {$second->getName()}'s",
        );
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function refused(): iterable
    {
        yield 'a host that is no push service' => [['kind' => 'web', 'address' => 'https://169.254.169.254/latest', 'keys' => ['p256dh' => self::P256DH, 'auth' => self::AUTH]]];
        yield 'a push service over http' => [['kind' => 'web', 'address' => 'http://fcm.googleapis.com/fcm/send/abc', 'keys' => ['p256dh' => self::P256DH, 'auth' => self::AUTH]]];
        yield 'a host that only ends like one' => [['kind' => 'web', 'address' => 'https://evilfcm.googleapis.com.example/x', 'keys' => ['p256dh' => self::P256DH, 'auth' => self::AUTH]]];
        yield 'a key that is no P-256 point' => [['kind' => 'web', 'address' => self::ENDPOINT, 'keys' => ['p256dh' => 'p', 'auth' => self::AUTH]]];
        yield 'a secret that is not 16 bytes' => [['kind' => 'web', 'address' => self::ENDPOINT, 'keys' => ['p256dh' => self::P256DH, 'auth' => 'a']]];
        yield 'a key that is not base64' => [['kind' => 'web', 'address' => self::ENDPOINT, 'keys' => ['p256dh' => '!!!', 'auth' => self::AUTH]]];
        yield 'a subscription without its keys' => [['kind' => 'web', 'address' => self::ENDPOINT]];
        yield 'no Expo token' => [['kind' => 'expo', 'address' => 'not-a-token']];
    }

    /** @param array<string, mixed> $body */
    #[Test]
    #[DataProvider('refused')]
    public function anAddressThatIsNoDevicesPushIsRefused(array $body): void
    {
        $this->account('refused@example.com');

        $answer = $this->request($this->signIn('refused@example.com'), 'PUT', $body);

        self::assertSame(422, $this->client->getResponse()->getStatusCode(), Json\encode($answer));
        self::assertSame([], $this->targets());
    }

    private function account(string $address): User
    {
        $user = self::service(UserRegistrar::class)->register($address, 'Pushed', self::PASSWORD)->user;
        self::onboard($user);

        return $user;
    }

    /** @return array{accessToken: string, refreshToken: string, sessionId: string} */
    private function signIn(string $address): array
    {
        $this->client->request('POST', '/api/auth/login', server: [
            'CONTENT_TYPE' => 'application/json',
        ], content: Json\encode(['email' => $address, 'password' => self::PASSWORD]));

        return Json\typed((string) $this->client->getResponse()->getContent(), Type\shape([
            'accessToken' => Type\string(),
            'refreshToken' => Type\string(),
            'sessionId' => Type\string(),
        ]));
    }

    /**
     * @param array{accessToken: string, refreshToken: string, sessionId: string} $session
     * @param ?array<string, mixed>                                               $body
     */
    private function request(#[SensitiveParameter] array $session, string $method, ?array $body): mixed
    {
        $this->client->request($method, '/api/auth/push-targets', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . $session['accessToken'],
        ], content: null === $body ? null : Json\encode($body));
        $content = (string) $this->client->getResponse()->getContent();

        return '' === $content ? null : Json\decode($content);
    }

    /** @return list<array<string, mixed>> */
    private function targets(): array
    {
        return self::service(Connection::class)->fetchAllAssociative(
            'SELECT kind, address, session_id, public_key, auth_secret FROM push_targets ORDER BY created_at, id',
        );
    }
}
