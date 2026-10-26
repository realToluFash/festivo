<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\User\Mail\UserMailer;
use App\Domain\User\SignInMethods\RecentProof;
use App\Domain\User\TwoFactor\SecondFactorCheck;
use App\Domain\User\TwoFactor\SecretBox;
use App\Domain\User\UserRegistrar;
use App\Entity\ProviderIdentity;
use App\Entity\TwoFactorFactor;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\IdentityProvider;
use App\Http\Exception\ApiException;
use App\Locale\SupportedLocales;
use App\Repository\ProviderIdentityRepository;
use App\Repository\TwoFactorFactorRepository;
use App\Tests\ApiTestCase;
use App\Tests\Fixtures\OpenIdConnect\TestSigningKeys;
use App\Tests\Traits\OnboardsAccounts;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use LogicException;
use OTPHP\TOTP;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Regex;
use Psl\Str;
use Psl\Type;
use Psl\Vec;
use SensitiveParameter;
use stdClass;
use Symfony\Component\Clock\Clock;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Mime\Email;

final class TwoFactorTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    /** @mago-expect lint:no-literal-password */
    private const string NEW_PASSWORD = 'a brand new passphrase';

    private const string ADDRESS = 'folake@example.com';

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->client->disableReboot();
        self::mockTime('2026-10-17 12:00:10');
        $this->user = $this->account();
    }

    #[Test]
    public function itIsOffUntilACodeFromTheNewSecretMatches(): void
    {
        $this->authenticated();
        $enrolled = $this->call('POST', '/api/auth/two-factor/enrol');

        self::assertStringStartsWith('otpauth://totp/Soirely', Type\string()->coerce($enrolled['otpauthUri']));
        self::assertStringContainsString('<svg', Type\string()->coerce($enrolled['qrSvg']));
        self::assertSame(['on' => false, 'recoveryCodesLeft' => 0], $this->call('GET', '/api/auth/two-factor'));

        $this->call('POST', '/api/auth/two-factor/activate', ['code' => '000000']);
        self::assertSame(ErrorCode::TwoFactorCodeInvalid->type(), $this->last()['type']);
        self::assertSame(['on' => false, 'recoveryCodesLeft' => 0], $this->call('GET', '/api/auth/two-factor'), 'a wrong code turns nothing on');
        self::assertSame(200, $this->login()[0], 'and sign-in still issues tokens');

        $this->authenticated();
        $codes = $this->call('POST', '/api/auth/two-factor/activate', ['code' => $this->codeNow(Type\string()->coerce($enrolled['secret']))]);

        self::assertCount(10, Type\vec(Type\string())->coerce($codes['recoveryCodes']));
        self::assertSame(['on' => true, 'recoveryCodesLeft' => 10], $this->call('GET', '/api/auth/two-factor'));
    }

    #[Test]
    public function onlyTheMatchingCodeEmailsTheAddressThatItWasTurnedOn(): void
    {
        $this->authenticated();
        $this->call('POST', '/api/auth/two-factor/enrol');
        self::assertCount(0, $this->turnedOnEmails(), 'starting setup sends nothing');
        $secret = Type\string()->coerce($this->call('POST', '/api/auth/two-factor/enrol')['secret']);
        self::assertCount(0, $this->turnedOnEmails(), 'nor does starting it again');
        $this->call('POST', '/api/auth/two-factor/activate', ['code' => '000000']);
        self::assertCount(0, $this->turnedOnEmails(), 'nor does a wrong code');

        $this->call('POST', '/api/auth/two-factor/activate', ['code' => $this->codeNow($secret)]);
        $sent = $this->turnedOnEmails();
        self::assertCount(1, $sent);
        $email = $sent[0];
        self::assertSame(self::ADDRESS, $email->getTo()[0]->getAddress());
        self::assertStringContainsString('turned on for your Soirely account on 17 October 2026', (string) $email->getTextBody());
        self::assertStringContainsString('"Lost your authenticator and your recovery codes?"', (string) $email->getTextBody());

        $this->call('POST', '/api/auth/two-factor/enrol');
        self::assertSame(ErrorCode::TwoFactorAlreadyOn->type(), $this->last()['type']);
        self::assertCount(0, $this->turnedOnEmails(), 'setting it up while it is on sends nothing');
        $this->call('POST', '/api/auth/two-factor/activate', ['code' => $this->codeNow($secret)]);
        self::assertSame(ErrorCode::TwoFactorNotEnrolled->type(), $this->last()['type']);
        self::assertCount(0, $this->turnedOnEmails(), 'nor does a code while it is on');
    }

    #[Test]
    public function theTurnedOnEmailSpeaksTheLanguageItWasTurnedOnInWhenTheAccountHasNone(): void
    {
        $this->fresh()->setLocale(null);
        self::em()->flush();
        $this->authenticated();
        $this->client->setServerParameter('HTTP_ACCEPT_LANGUAGE', 'fr');
        $secret = Type\string()->coerce($this->call('POST', '/api/auth/two-factor/enrol')['secret']);

        $this->call('POST', '/api/auth/two-factor/activate', ['code' => $this->codeNow($secret)]);

        self::assertCount(10, Type\vec(Type\string())->coerce($this->last()['recoveryCodes']));
        self::assertStringContainsString('17 octobre 2026', (string) $this->turnedOnEmails()[0]->getTextBody());
    }

    #[Test]
    public function aPasswordSignInGetsAChallengeAndNoTokensUntilTheCodePasses(): void
    {
        $secret = $this->turnedOn()['secret'];

        [$status, $body] = $this->login();

        self::assertSame(202, $status);
        self::assertSame(self::ADDRESS, $body['email']);
        self::assertArrayNotHasKey('accessToken', $body);
        self::assertArrayNotHasKey('account', $body, 'nothing about the account before the second factor');

        self::mockTime('+30 seconds');
        $signedIn = $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $body['twoFactorChallenge'], 'code' => $this->codeNow($secret)]);

        self::assertSame(200, $this->statusCode(), Json\encode($signedIn));
        self::assertIsString($signedIn['accessToken'] ?? null);
        self::assertArrayHasKey('account', $signedIn);
    }

    #[Test]
    public function googleSignInIsStoppedAtTheSameChallenge(): void
    {
        $this->turnedOn();
        self::service(EntityManagerInterface::class)->persist(new ProviderIdentity($this->fresh(), IdentityProvider::Google, 'g-folake'));
        self::service(EntityManagerInterface::class)->flush();

        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');
        $body = $this->call('POST', '/api/auth/oauth/google', ['idToken' => $this->googleToken('g-folake')]);

        self::assertSame(202, $this->statusCode(), Json\encode($body));
        self::assertIsString($body['twoFactorChallenge'] ?? null);
        self::assertArrayNotHasKey('accessToken', $body);
    }

    #[Test]
    public function aFirstGoogleSignInLinksOnlyOnceTheCodePasses(): void
    {
        $secret = $this->turnedOn()['secret'];
        $identities = self::service(ProviderIdentityRepository::class);

        $body = $this->call('POST', '/api/auth/oauth/google', ['idToken' => $this->googleToken('g-new')]);
        self::assertSame(202, $this->statusCode(), Json\encode($body));
        self::assertArrayNotHasKey('linked', $body, 'the challenge says nothing about linking');
        $challenge = Type\string()->coerce($body['twoFactorChallenge']);
        self::assertNull($identities->findOneBySubject(IdentityProvider::Google, 'g-new'));

        $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $challenge, 'code' => '000000']);
        self::assertNull($identities->findOneBySubject(IdentityProvider::Google, 'g-new'), 'not after a wrong code');

        self::mockTime('+30 seconds');
        $passed = $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $challenge, 'code' => $this->codeNow($secret)]);
        self::assertSame(200, $this->statusCode(), Json\encode($passed));
        self::assertTrue($passed['linked']);
        self::assertSame($this->user->getId()->toRfc4122(), $identities->findOneBySubject(IdentityProvider::Google, 'g-new')?->getUser()->getId()->toRfc4122());
    }

    /** Each refusal in the words of the screen that sends it, and none of them spends a try. */
    #[Test]
    public function aCodeSentAsANumberIsAFieldErrorEverywhereTwoFactorAsksForOne(): void
    {
        $secret = $this->turnedOn()['secret'];
        $challenge = $this->challenge();

        $refused = [
            ['/api/auth/two-factor/verify', ['challenge' => $challenge, 'code' => 123456], 'code', 'Enter the 6-digit code from your app.', false],
            ['/api/auth/two-factor/verify', ['challenge' => $challenge, 'recoveryCode' => 12345], 'recoveryCode', 'Enter one of your recovery codes.', false],
            ['/api/auth/two-factor/disable', ['code' => 123456], 'code', 'Enter a code from your app, or a recovery code.', true],
            ['/api/auth/two-factor/recovery-codes', ['code' => null], 'code', 'Enter a code from your app, or a recovery code.', true],
            ['/api/auth/two-factor/disable', null, 'code', 'Enter a code from your app, or a recovery code.', true],
            ['/api/auth/two-factor/verify', ['challenge' => $challenge], 'code', 'Enter the 6-digit code from your app.', false],
            ['/api/auth/two-factor/verify', ['challenge' => $challenge, 'code' => null, 'recoveryCode' => null], 'code', 'Enter the 6-digit code from your app.', false],
        ];

        foreach ($refused as [$path, $body, $field, $message, $signedIn]) {
            $signedIn ? $this->authenticated() : $this->client->setServerParameter('HTTP_AUTHORIZATION', '');
            $answer = $this->call('POST', $path, $body);

            self::assertSame(422, $this->statusCode(), $path . ' ' . Json\encode($answer));
            self::assertSame([['propertyPath' => $field, 'message' => $message, 'code' => 'validation_failed']], $answer['violations'], $path);
        }

        // Seven refusals: had any spent a try, the budget of five would be gone and this would be paused.
        self::mockTime('+30 seconds');
        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');
        $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $challenge, 'code' => $this->codeNow($secret)]);
        self::assertSame(200, $this->statusCode(), Json\encode($this->last()));
    }

    #[Test]
    public function aCodeCannotBeReplayedInsideItsOwnWindow(): void
    {
        $secret = $this->turnedOn()['secret'];
        self::mockTime('+30 seconds');
        $code = $this->codeNow($secret);

        $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $this->challenge(), 'code' => $code]);
        self::assertSame(200, $this->statusCode());

        $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $this->challenge(), 'code' => $code]);
        self::assertSame(ErrorCode::TwoFactorCodeInvalid->type(), $this->last()['type'], 'refused as a wrong code is');
    }

    #[Test]
    public function aRecoveryCodeWorksOnceAndThenSaysItWasUsed(): void
    {
        $recovery = $this->turnedOn()['codes'][0];

        $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $this->challenge(), 'recoveryCode' => Str\uppercase($recovery)]);
        self::assertSame(200, $this->statusCode(), 'typed in either case');

        $this->authenticated();
        self::assertSame(['on' => true, 'recoveryCodesLeft' => 9], $this->call('GET', '/api/auth/two-factor'));

        $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $this->challenge(), 'recoveryCode' => $recovery]);
        self::assertSame(ErrorCode::RecoveryCodeUsed->type(), $this->last()['type']);
    }

    #[Test]
    public function newCodesReplaceEveryOldOneAndAnOldOneReadsAsWrong(): void
    {
        $codes = $this->turnedOn()['codes'];
        $old = $codes[0];

        $this->authenticated();
        $new = Type\vec(Type\string())->coerce($this->call('POST', '/api/auth/two-factor/recovery-codes', ['code' => $codes[1]])['recoveryCodes']);
        self::assertCount(10, $new);
        self::assertNotContains($old, $new);

        $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $this->challenge(), 'recoveryCode' => $old]);
        self::assertSame(ErrorCode::TwoFactorCodeInvalid->type(), $this->last()['type'], 'not "replaced": that would say it was once real');
    }

    /** Checked in one request: the test kernel resets the limiter's storage between requests. */
    /** Changing a factor takes the current one, or a stolen session could mint codes past it. */
    #[Test]
    public function newCodesNeedTheCurrentFactor(): void
    {
        $codes = $this->turnedOn()['codes'];
        $this->authenticated();

        $this->call('POST', '/api/auth/two-factor/recovery-codes', ['code' => '000000']);
        self::assertSame(ErrorCode::TwoFactorCodeInvalid->type(), $this->last()['type']);

        $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $this->challenge(), 'recoveryCode' => $codes[0]]);
        self::assertSame(200, $this->statusCode(), 'the old codes still work: nothing was replaced');
    }

    /** Forty bits is too few for a bare SHA-256: each is a salted slow hash (NIST SP 800-63B 5.1.2.2). */
    #[Test]
    public function recoveryCodesAreKeptAsSaltedSlowHashes(): void
    {
        $codes = $this->turnedOn()['codes'];
        $stored = Type\vec(Type\string())->coerce(self::service(EntityManagerInterface::class)->getConnection()->fetchFirstColumn('SELECT code_hash FROM recovery_codes'));

        self::assertCount(10, $stored);
        self::assertNotContains(\hash('sha256', Str\replace($codes[0], '-', '')), $stored);
        self::assertStringStartsWith('$', $stored[0], 'a password_hash string, with its algorithm and salt');
        self::assertCount(10, Vec\unique($stored));
    }

    #[Test]
    public function fiveWrongCodesPauseCodeEntryAndSayUntilWhen(): void
    {
        $secret = $this->turnedOn()['secret'];
        $factor = Type\instance_of(TwoFactorFactor::class)->coerce(self::service(TwoFactorFactorRepository::class)->findActiveFor($this->fresh()));
        $check = self::service(SecondFactorCheck::class);

        foreach (Vec\range(1, 4) as $_) {
            self::assertSame(ErrorCode::TwoFactorCodeInvalid, $this->refusal(static fn () => $check->passCode($factor, '000000'))->errorCode);
        }

        $paused = $this->refusal(static fn () => $check->passCode($factor, '000000'));
        self::assertSame(ErrorCode::TooManyAttempts, $paused->errorCode);
        self::assertMatchesRegularExpression('/Try again at \d\d:\d\d UTC\./', self::worded($paused));
        self::assertArrayHasKey('Retry-After', $paused->headers);

        self::mockTime('+30 seconds');
        $code = $this->codeNow($secret);
        self::assertSame(ErrorCode::TooManyAttempts, $this->refusal(static fn () => $check->passCode($factor, $code))->errorCode, 'a right code waits out the pause too');
    }

    #[Test]
    public function theProofStepsPauseSaysUntilWhenToo(): void
    {
        $this->turnedOn();
        $proof = self::service(RecentProof::class);

        foreach (Vec\range(1, 4) as $_) {
            self::assertSame(ErrorCode::TwoFactorCodeInvalid, $this->refusal(fn () => $proof->prove($this->fresh(), self::PASSWORD, null, '000000'))->errorCode);
        }

        $paused = $this->refusal(fn () => $proof->prove($this->fresh(), self::PASSWORD, null, '000000'));
        self::assertSame(ErrorCode::TooManyAttempts, $paused->errorCode);
        self::assertMatchesRegularExpression('/^Too many wrong codes\. Try again at \d\d:\d\d UTC\.$/', self::worded($paused));
        self::assertArrayHasKey('pendingProof', $paused->members);
    }

    #[Test]
    public function turningItOffNeedsACodeAndEmailsTheAddress(): void
    {
        $recovery = $this->turnedOn()['codes'][0];
        $this->authenticated();

        $this->call('POST', '/api/auth/two-factor/disable', ['code' => 'not-a-code']);
        self::assertSame(ErrorCode::TwoFactorCodeInvalid->type(), $this->last()['type']);

        $this->call('POST', '/api/auth/two-factor/disable', ['code' => $recovery]);
        self::assertSame(204, $this->statusCode());

        $email = Type\instance_of(Email::class)->coerce(Iter\last(self::getMailerMessages()));
        self::assertSame(self::ADDRESS, $email->getTo()[0]->getAddress());
        self::assertStringContainsString('turned off', (string) $email->getTextBody());

        self::assertSame(200, $this->login()[0], 'the next sign-in asks for no code');
    }

    #[Test]
    public function aChallengeLastsFiveMinutes(): void
    {
        $secret = $this->turnedOn()['secret'];
        $challenge = $this->challenge();

        self::mockTime('+6 minutes');
        $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $challenge, 'code' => $this->codeNow($secret)]);

        self::assertSame(401, $this->statusCode());
        self::assertSame(ErrorCode::TwoFactorChallengeInvalid->type(), $this->last()['type']);
    }

    /** A reset link alone changes nothing: the code comes before the new password (OWASP, NIST SP 800-63B). */
    #[Test]
    public function aPasswordResetAsksForTheCodeBeforeAnythingChanges(): void
    {
        $secret = $this->turnedOn()['secret'];
        self::mockTime('+30 seconds');
        $elsewhere = $this->call('POST', '/api/auth/two-factor/verify', ['challenge' => $this->challenge(), 'code' => $this->codeNow($secret)]);
        $refreshToken = Type\string()->coerce($elsewhere['refreshToken'] ?? null);

        $this->call('POST', '/api/auth/password/forgot', ['email' => self::ADDRESS]);
        $link = Type\instance_of(Email::class)->coerce(Iter\last(self::getMailerMessages()));
        $token = Regex\first_match((string) $link->getTextBody(), '/reset-password\?token=([0-9a-f]+)/')[1] ?? '';

        self::assertTrue($this->call('POST', '/api/auth/password/reset/check', ['token' => $token])['twoFactor']);

        $this->call('POST', '/api/auth/password/reset', ['token' => $token, 'password' => self::NEW_PASSWORD]);
        self::assertSame(ErrorCode::TwoFactorRequired->type(), $this->last()['type'], 'no new password before the code');
        self::assertSame(202, $this->login()[0], 'the old password still signs in, to a challenge');
        $this->call('POST', '/api/auth/refresh', ['refreshToken' => $refreshToken]);
        self::assertSame(200, $this->statusCode(), 'and no session was ended');
        $refreshToken = Type\string()->coerce($this->last()['refreshToken'] ?? null);

        foreach ([['token' => $token], ['token' => $token, 'code' => null, 'recoveryCode' => null]] as $neither) {
            $this->call('POST', '/api/auth/password/reset/code', $neither);
            self::assertSame(422, $this->statusCode(), 'neither code sent is a field error, not a bad request');
            self::assertSame([['propertyPath' => 'code', 'message' => 'Enter the 6-digit code from your app.', 'code' => 'validation_failed']], $this->last()['violations']);
        }

        $this->call('POST', '/api/auth/password/reset/code', ['token' => $token, 'code' => '000000']);
        self::assertSame(ErrorCode::TwoFactorCodeInvalid->type(), $this->last()['type']);

        self::mockTime('+30 seconds');
        $this->call('POST', '/api/auth/password/reset/code', ['token' => $token, 'code' => $this->codeNow($secret)]);
        self::assertSame(204, $this->statusCode());

        $signedIn = $this->call('POST', '/api/auth/password/reset', ['token' => $token, 'password' => self::NEW_PASSWORD]);
        self::assertIsString($signedIn['accessToken'] ?? null, 'the code passed, so this device is signed in');

        $this->call('POST', '/api/auth/refresh', ['refreshToken' => $refreshToken]);
        self::assertSame(401, $this->statusCode(), 'now every other session has ended');
        self::assertSame(401, $this->loginWith(self::PASSWORD), 'and the old password no longer works');
    }

    #[Test]
    public function theStoredSecretIsUnreadableWithoutTheKey(): void
    {
        $secret = $this->turnedOn()['secret'];
        $stored = Type\string()->coerce(self::service(EntityManagerInterface::class)->getConnection()->fetchOne('SELECT encrypted_secret FROM two_factor_factors'));

        self::assertStringNotContainsString($secret, $stored);
        self::assertSame($secret, self::service(SecretBox::class)->open($stored), 'readable with the configured key');

        $this->expectException(LogicException::class);
        new SecretBox(\base64_encode(Str\repeat("\0", \SODIUM_CRYPTO_SECRETBOX_KEYBYTES)))->open($stored);
    }

    private function refusal(callable $attempt): ApiException
    {
        try {
            $attempt();
        } catch (ApiException $e) {
            return $e;
        }

        self::fail('the code was accepted');
    }

    /** @return array{secret: string, codes: list<string>} */
    private function turnedOn(): array
    {
        $this->authenticated();
        $secret = Type\string()->coerce($this->call('POST', '/api/auth/two-factor/enrol')['secret']);
        $codes = Type\vec(Type\string())->coerce($this->call('POST', '/api/auth/two-factor/activate', ['code' => $this->codeNow($secret)])['recoveryCodes']);
        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');

        return ['secret' => $secret, 'codes' => $codes];
    }

    private function challenge(): string
    {
        [$status, $body] = $this->login();
        self::assertSame(202, $status);

        return Type\string()->coerce($body['twoFactorChallenge']);
    }

    private function loginWith(#[SensitiveParameter] string $password): int
    {
        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');
        $this->call('POST', '/api/auth/login', ['email' => self::ADDRESS, 'password' => $password]);

        return $this->statusCode();
    }

    /** @return array{0: int, 1: array<string, mixed>} */
    private function login(): array
    {
        $this->client->setServerParameter('HTTP_AUTHORIZATION', '');
        $body = $this->call('POST', '/api/auth/login', ['email' => self::ADDRESS, 'password' => self::PASSWORD]);

        return [$this->statusCode(), $body];
    }

    /** @return list<Email> */
    private function turnedOnEmails(): array
    {
        $subjects = Vec\map(SupportedLocales::ALL, static fn (string $locale): string => self::service(UserMailer::class)->line('twoFactor.on.subject', $locale));

        return Vec\filter(
            Vec\map(self::getMailerMessages(), static fn (object $message): Email => Type\instance_of(Email::class)->coerce($message)),
            static fn (Email $email): bool => Iter\contains($subjects, $email->getSubject()),
        );
    }

    private function codeNow(#[SensitiveParameter] string $secret): string
    {
        return TOTP::createFromSecret(Type\non_empty_string()->coerce($secret))->at(Type\uint()->coerce(self::now()));
    }

    private static function now(): int
    {
        return new Clock()->now()->getTimestamp();
    }

    private function googleToken(string $subject): string
    {
        $configured = static fn (string $name): string => Str\trim(Str\split(Type\string()->coerce($_SERVER[$name] ?? $_ENV[$name] ?? ''), ',')[0] ?? '');

        return self::service(TestSigningKeys::class)->sign([
            'iss' => $configured('OAUTH_GOOGLE_ISSUERS'),
            'aud' => $configured('OAUTH_GOOGLE_CLIENT_IDS'),
            'iat' => new Clock()->now()->modify('-1 minute'),
            'exp' => new Clock()->now()->modify('+1 hour'),
            'sub' => $subject,
            'email' => self::ADDRESS,
            'email_verified' => true,
        ]);
    }

    private function account(): User
    {
        $user = self::service(UserRegistrar::class)->register(self::ADDRESS, 'Folake', self::PASSWORD)->user;
        self::onboard($user);

        return $user;
    }

    private function fresh(): User
    {
        return Type\instance_of(User::class)->coerce(self::service(EntityManagerInterface::class)->find(User::class, $this->user->getId()));
    }

    private function authenticated(): void
    {
        $this->client->setServerParameter('HTTP_AUTHORIZATION', 'Bearer ' . self::service(JWTTokenManagerInterface::class)->create($this->fresh()));
    }

    /**
     * @param array<string, mixed>|null $body
     *
     * @return array<string, mixed>
     */
    private function call(string $method, string $path, ?array $body = null): array
    {
        $this->client->request($method, $path, server: ['CONTENT_TYPE' => 'application/json'], content: Json\encode($body ?? new stdClass()));

        return $this->last();
    }

    /** @return array<string, mixed> */
    private function last(): array
    {
        $raw = (string) $this->client->getResponse()->getContent();

        return '' === $raw ? [] : Type\dict(Type\string(), Type\mixed())->coerce(Json\decode($raw));
    }

    private function statusCode(): int
    {
        return $this->client->getResponse()->getStatusCode();
    }
}
