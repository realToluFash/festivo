<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\Device\DeviceIdentity;
use App\Domain\User\Device\KnownDevices;
use App\Domain\User\UserRegistrar;
use App\Entity\KnownDevice;
use App\Entity\User;
use App\Http\AfterResponse;
use App\Repository\UserRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use OTPHP\TOTP;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use Symfony\Component\Clock\Clock;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Mime\Email;

final class NewDeviceSignInTest extends ApiTestCase
{
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string PHONE = 'phone-install-0000000001';

    private const string TABLET = 'tablet-install-000000002';

    /** @var list<Email> each request's mail, gathered as it is sent: the client's next request boots a fresh kernel */
    private array $sent = [];

    private const string SAFARI_ON_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

    #[Test]
    public function registeringEmailsNothingAndTheDeviceIsKnownFromThen(): void
    {
        $this->register('reg-device@example.com', self::PHONE);
        $this->signIn('reg-device@example.com', self::PHONE);

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame([], $this->noticesTo('reg-device@example.com'));
    }

    #[Test]
    public function theFirstSignInOnASecondDeviceEmailsAndTheNextOneThereDoesNot(): void
    {
        $this->register('second-device@example.com', self::PHONE);

        $this->signIn('second-device@example.com', self::TABLET);
        self::assertCount(1, $this->noticesTo('second-device@example.com'));

        $this->signIn('second-device@example.com', self::TABLET);
        self::assertCount(1, $this->noticesTo('second-device@example.com'), 'one email per device');
    }

    #[Test]
    public function aRefreshEmailsNothing(): void
    {
        $this->register('refresh-device@example.com', self::PHONE);
        $session = $this->signIn('refresh-device@example.com', self::TABLET);
        $before = Iter\count($this->noticesTo('refresh-device@example.com'));

        $this->client->request('POST', '/api/auth/refresh', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_DEVICE_ID' => self::TABLET,
        ], content: Json\encode(['refreshToken' => $session['refreshToken']]));
        $this->gather();

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertCount($before, $this->noticesTo('refresh-device@example.com'));
    }

    #[Test]
    public function theWebIsKnownByItsCookieAndAClearedCookieIsANewDevice(): void
    {
        $this->register('web-device@example.com');
        $cookie = $this->client->getCookieJar()->get(DeviceIdentity::COOKIE, '/api/auth');
        self::assertNotNull($cookie, 'registering set the device cookie');
        self::assertTrue($cookie->isHttpOnly());

        $this->signIn('web-device@example.com');
        self::assertSame([], $this->noticesTo('web-device@example.com'), 'the same browser');

        $this->client->getCookieJar()->clear();
        $this->signIn('web-device@example.com');
        self::assertCount(1, $this->noticesTo('web-device@example.com'), 'a cleared cookie is a new device');
    }

    #[Test]
    public function theEmailSaysWhenWhatDeviceFromWhereAndWhereToLook(): void
    {
        $this->register('content-device@example.com', self::PHONE);

        $this->signIn('content-device@example.com', self::TABLET, [
            'HTTP_USER_AGENT' => self::SAFARI_ON_IPHONE,
            'REMOTE_ADDR' => '102.89.33.14',
        ]);

        $mail = Type\instance_of(Email::class)->coerce(Iter\first($this->noticesTo('content-device@example.com')));
        $text = (string) $mail->getTextBody();

        self::assertSame('content-device@example.com', $mail->getTo()[0]->getAddress());
        self::assertMatchesRegularExpression('/^When: \w+ \d+ \w+ at \d\d:\d\d UTC$/m', $text);
        self::assertStringContainsString('Device: Safari on iPhone', $text);
        self::assertStringContainsString('Network address: 102.89.33.14', $text);
        self::assertMatchesRegularExpression('#^Review your devices: \S+/app/account/security$#m', $text);
        self::assertStringContainsString("If this wasn't you, change your password and sign out the devices you don't recognise.", $text);
    }

    #[Test]
    public function anAccountWithNoPasswordIsNotToldToChangeOne(): void
    {
        $user = self::service(UserRegistrar::class)->registerFromProvider('provider-device@example.com', 'Device Owner')->user;
        self::em()->flush();

        self::service(KnownDevices::class)->signedIn($user, $this->fromDevice(self::TABLET));
        self::service(AfterResponse::class)->run();
        $this->gather();

        $text = (string) Type\instance_of(Email::class)->coerce(Iter\first($this->noticesTo('provider-device@example.com')))->getTextBody();
        self::assertStringContainsString("If this wasn't you, sign out the devices you don't recognise from Security.", $text);
        self::assertStringNotContainsString('password', $text);
    }

    #[Test]
    public function withTwoFactorOnTheEmailWaitsForTheCode(): void
    {
        $session = $this->register('two-factor-device@example.com', self::PHONE);
        $owner = self::service(UserRepository::class)->findOneByPrimaryEmailAddress('two-factor-device@example.com') ?? self::fail('no account');
        self::onboard($owner);
        self::em()->flush();
        $bearer = ['HTTP_AUTHORIZATION' => 'Bearer ' . Type\string()->coerce($session['accessToken'])];
        $this->client->request('POST', '/api/auth/two-factor/enrol', server: ['CONTENT_TYPE' => 'application/json', ...$bearer], content: '{}');
        self::assertSame(200, $this->client->getResponse()->getStatusCode(), (string) $this->client->getResponse()->getContent());
        $secret = Type\non_empty_string()->coerce($this->decode()['secret']);
        $this->client->request('POST', '/api/auth/two-factor/activate', server: ['CONTENT_TYPE' => 'application/json', ...$bearer], content: Json\encode(['code' => self::codeNow($secret)]));
        self::assertSame(200, $this->client->getResponse()->getStatusCode(), (string) $this->client->getResponse()->getContent());
        $recoveryCode = Type\vec(Type\string())->coerce($this->decode()['recoveryCodes'])[0];

        $challenge = Type\string()->coerce($this->signIn('two-factor-device@example.com', self::TABLET)['twoFactorChallenge']);
        self::assertSame([], $this->noticesTo('two-factor-device@example.com'), 'nobody is in yet');

        $this->client->request('POST', '/api/auth/two-factor/verify', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_DEVICE_ID' => self::TABLET,
        ], content: Json\encode(['challenge' => $challenge, 'recoveryCode' => $recoveryCode]));
        $this->gather();

        self::assertSame(200, $this->client->getResponse()->getStatusCode(), (string) $this->client->getResponse()->getContent());
        self::assertCount(1, $this->noticesTo('two-factor-device@example.com'));
    }

    #[Test]
    public function aRecoveryEmailsNothingOfItsOwnAndLeavesTheDeviceKnown(): void
    {
        $this->register('recovered-device@example.com', self::PHONE);
        $this->client->request('POST', '/api/auth/password/forgot', server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode(['email' => 'recovered-device@example.com']));
        $link = Type\instance_of(Email::class)->coerce(Iter\last(self::getMailerMessages()));
        $token = Regex\first_match((string) $link->getTextBody(), '/reset-password\?token=([0-9a-f]+)/')[1] ?? '';

        $this->client->request('POST', '/api/auth/password/reset', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_DEVICE_ID' => self::TABLET,
        ], content: Json\encode(['token' => $token, 'password' => self::PASSWORD . ' again']));
        $this->gather();
        self::assertSame(200, $this->client->getResponse()->getStatusCode(), (string) $this->client->getResponse()->getContent());

        $this->client->request('POST', '/api/auth/login', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_DEVICE_ID' => self::TABLET,
        ], content: Json\encode(['email' => 'recovered-device@example.com', 'password' => self::PASSWORD . ' again']));
        $this->gather();

        self::assertSame(200, $this->client->getResponse()->getStatusCode());
        self::assertSame([], $this->noticesTo('recovered-device@example.com'));
    }

    #[Test]
    public function aUserAgentItCannotReadIsShownAsItCame(): void
    {
        $this->register('raw-agent@example.com', self::PHONE);

        $this->signIn('raw-agent@example.com', self::TABLET, ['HTTP_USER_AGENT' => 'Soirely/1.0 CFNetwork/1568 Darwin/24.1.0']);

        $mail = Type\instance_of(Email::class)->coerce(Iter\first($this->noticesTo('raw-agent@example.com')));
        self::assertStringContainsString('Device: Soirely/1.0 CFNetwork/1568 Darwin/24.1.0', (string) $mail->getTextBody());
    }

    /** The app's own user agent reads as the devices card reads it, without its versions (sc-1242). */
    #[Test]
    public function theAppIsNamedByItsDeviceClass(): void
    {
        $this->register('app-agent@example.com', self::PHONE);

        $this->signIn('app-agent@example.com', self::TABLET, ['HTTP_USER_AGENT' => 'Soirely/1.4.0 (iPadOS 18.1; iPad)']);

        $mail = Type\instance_of(Email::class)->coerce(Iter\first($this->noticesTo('app-agent@example.com')));
        self::assertStringContainsString('Device: Soirely app on iPad', (string) $mail->getTextBody());
    }

    #[Test]
    public function noMoreThanTenADayGoOutAndTheRestAreStillKnown(): void
    {
        $user = $this->account('capped-device@example.com');
        $knownDevices = self::service(KnownDevices::class);

        foreach (Vec\range(1, KnownDevices::DAILY_CAP + 2) as $n) {
            $knownDevices->signedIn($user, $this->fromDevice(Str\format('capped-install-%016d', $n)));
        }
        self::service(AfterResponse::class)->run();
        $this->gather();

        self::assertCount(KnownDevices::DAILY_CAP, $this->noticesTo('capped-device@example.com'));
        self::assertCount(KnownDevices::DAILY_CAP + 2, self::em()->getRepository(KnownDevice::class)->findBy(['user' => $user]), 'every device is remembered');
    }

    #[Test]
    public function anIdentifierThatIsNotOneIsIgnoredRatherThanTrusted(): void
    {
        $request = $this->fromDevice('short');

        self::assertNotSame('short', DeviceIdentity::of($request));
    }

    private function account(string $address): User
    {
        $result = self::service(UserRegistrar::class)->register($address, 'Device Owner', self::PASSWORD);
        self::em()->flush();

        return $result->user;
    }

    private static function codeNow(#[SensitiveParameter] string $secret): string
    {
        return TOTP::createFromSecret(Type\non_empty_string()->coerce($secret))->at(Type\uint()->coerce(new Clock()->now()->getTimestamp()));
    }

    private function fromDevice(string $id): Request
    {
        return Request::create('/api/auth/login', 'POST', server: ['HTTP_X_DEVICE_ID' => $id]);
    }

    /** Registering ends at the code from the email, which is where the account and its first session begin. */
    /** @return array<string, mixed> */
    private function register(string $email, ?string $device = null): array
    {
        $this->client->request('POST', '/api/auth/register', server: [
            'CONTENT_TYPE' => 'application/json',
            ...$this->deviceHeader($device),
        ], content: Json\encode(['email' => $email, 'name' => 'Device Owner', 'password' => self::PASSWORD]));
        $handle = Type\string()->coerce(Json\typed((string) $this->client->getResponse()->getContent(), Type\dict(Type\string(), Type\mixed()))['registration']);
        $mail = Type\instance_of(Email::class)->coerce(Iter\last(self::getMailerMessages()));
        $code = Regex\first_match((string) $mail->getTextBody(), '/\b(\d{6})\b/')[1] ?? '';

        $this->client->request('POST', '/api/auth/register/verify', server: [
            'CONTENT_TYPE' => 'application/json',
            ...$this->deviceHeader($device),
        ], content: Json\encode(['registration' => $handle, 'code' => $code, 'refreshTokenIn' => null === $device ? 'cookie' : 'body']));

        self::assertSame(201, $this->client->getResponse()->getStatusCode(), (string) $this->client->getResponse()->getContent());
        $this->gather();

        return $this->decode();
    }

    /**
     * @param array<string, string> $server
     *
     * @return array<string, mixed>
     */
    private function signIn(string $email, ?string $device = null, array $server = []): array
    {
        $this->client->request('POST', '/api/auth/login', server: [
            'CONTENT_TYPE' => 'application/json',
            ...$this->deviceHeader($device),
            ...$server,
        ], content: Json\encode(['email' => $email, 'password' => self::PASSWORD, 'refreshTokenIn' => null === $device ? 'cookie' : 'body']));
        $this->gather();

        return $this->decode();
    }

    /** @return array<string, mixed> */
    private function decode(): array
    {
        return Json\typed((string) $this->client->getResponse()->getContent(), Type\dict(Type\string(), Type\mixed()));
    }

    /** @return array<string, string> */
    private function deviceHeader(?string $device): array
    {
        return null === $device ? [] : ['HTTP_X_DEVICE_ID' => $device];
    }

    private function gather(): void
    {
        foreach (self::getMailerMessages() as $message) {
            if ($message instanceof Email) {
                $this->sent[] = $message;
            }
        }
    }

    /** @return list<Email> every "New sign-in" email to the address, this whole test */
    private function noticesTo(string $address): array
    {
        return Vec\filter(
            $this->sent,
            static fn (Email $mail): bool => 'New sign-in to Soirely' === $mail->getSubject() && $address === $mail->getTo()[0]->getAddress(),
        );
    }
}
